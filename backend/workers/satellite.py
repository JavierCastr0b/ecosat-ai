import os
import json
from decimal import Decimal

from shared.vendor import add_vendor_path

add_vendor_path()

import boto3
import ee

# Indices agricolas principales sobre Sentinel-2 SR.
# normalizedDifference(a, b) = (a-b)/(a+b)
INDEX_BANDS = {
    "NDVI": ("B8", "B4"),    # vegetacion: (NIR - Red)  / (NIR + Red)
    "NDMI": ("B8", "B11"),   # humedad:    (NIR - SWIR1) / (NIR + SWIR1)
    "NDRE": ("B8", "B5"),    # clorofila:  (NIR - RedEdge) / (NIR + RedEdge)
}

_initialized = False
VIS_PARAMS = {
    "dimensions": 768,
    "format": "png",
}


def _ensure_ee():
    """Inicializa Earth Engine una sola vez (se reusa entre invocaciones).

    En local (sin el service account en el entorno) asume que EE ya fue
    inicializado a mano con ee.Authenticate()/ee.Initialize() y no hace nada.
    """
    global _initialized
    if _initialized:
        return
    if "GEE_SERVICE_ACCOUNT" not in os.environ:
        _initialized = True   # EE ya inicializado externamente (dev local)
        return
    creds = ee.ServiceAccountCredentials(
        os.environ["GEE_SERVICE_ACCOUNT"],
        key_data=os.environ["GEE_SERVICE_ACCOUNT_JSON"],
    )
    ee.Initialize(creds, project=os.environ["GEE_PROJECT"])
    _initialized = True


def _mask_clouds(image):
    """Enmascara nubes y cirros usando la banda QA60."""
    qa = image.select("QA60")
    cloud = qa.bitwiseAnd(1 << 10).eq(0)
    cirrus = qa.bitwiseAnd(1 << 11).eq(0)
    return image.updateMask(cloud.And(cirrus))


def _sentinel_composite(geometry, date_start, date_end):
    _ensure_ee()
    region = ee.Geometry(geometry)
    compuesto = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(region)
        .filterDate(date_start, date_end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
        .map(_mask_clouds)
        .median()
    )
    return region, compuesto


def _index_image(compuesto, idx):
    if idx in INDEX_BANDS:
        a, b = INDEX_BANDS[idx]
        return compuesto.normalizedDifference([a, b]).rename(idx)
    if idx == "SAVI":
        # SAVI corrige el efecto del suelo visible en cultivos jovenes o ralos.
        # Sentinel-2 SR viene escalado por 10000 en Earth Engine; para SAVI
        # hay que usar reflectancia 0-1 porque el factor L=0.5 esta en esa escala.
        return compuesto.expression(
            "((nir - red) / (nir + red + 0.5)) * 1.5",
            {
                "nir": compuesto.select("B8").multiply(0.0001),
                "red": compuesto.select("B4").multiply(0.0001),
            },
        ).rename(idx)
    return None


def _generar_visuales(region, compuesto):
    """Genera miniaturas visuales del lote para la galeria historica.

    Usamos URLs temporales de Earth Engine: son suficientes para la demo y se
    guardan con el reporte. Si GEE no puede generar alguna imagen, no bloquea
    el calculo de indices.
    """
    visuales = {}
    try:
        rgb = compuesto.select(["B4", "B3", "B2"]).visualize(
            min=0,
            max=3000,
            gamma=1.2,
        )
        visuales["rgb_thumbnail_url"] = rgb.clip(region).getThumbURL({
            **VIS_PARAMS,
            "region": region,
        })
    except Exception as e:
        print(f"No se pudo generar miniatura RGB: {e}")

    try:
        ndvi = compuesto.normalizedDifference(["B8", "B4"]).rename("NDVI")
        ndvi_visual = ndvi.visualize(
            min=0,
            max=0.85,
            palette=["#8C2415", "#F6C343", "#9EE832", "#1F7A1F"],
        )
        visuales["ndvi_thumbnail_url"] = ndvi_visual.clip(region).getThumbURL({
            **VIS_PARAMS,
            "region": region,
        })
    except Exception as e:
        print(f"No se pudo generar miniatura NDVI: {e}")

    return visuales


def calcular_indices(geometry, indices, date_start, date_end):
    """Consulta Sentinel-2 en GEE y devuelve mean/min/max de cada indice.

    Solo necesita credenciales de GEE, NO toca AWS -> testeable en local.
    """
    region, compuesto = _sentinel_composite(geometry, date_start, date_end)

    resultado = {}
    for idx in indices:
        index_image = _index_image(compuesto, idx)
        if index_image is None:
            continue

        stats = index_image.reduceRegion(
            reducer=ee.Reducer.mean().combine(ee.Reducer.minMax(), sharedInputs=True),
            geometry=region,
            scale=20,
            maxPixels=int(1e9),
        ).getInfo()
        resultado[idx] = {
            "mean": stats.get(f"{idx}_mean"),
            "min": stats.get(f"{idx}_min"),
            "max": stats.get(f"{idx}_max"),
        }
    return resultado


def analizar_lote(geometry, indices, date_start, date_end):
    region, compuesto = _sentinel_composite(geometry, date_start, date_end)
    indices_stats = {}
    for idx in indices:
        index_image = _index_image(compuesto, idx)
        if index_image is None:
            continue
        stats = index_image.reduceRegion(
            reducer=ee.Reducer.mean().combine(ee.Reducer.minMax(), sharedInputs=True),
            geometry=region,
            scale=20,
            maxPixels=int(1e9),
        ).getInfo()
        indices_stats[idx] = {
            "mean": stats.get(f"{idx}_mean"),
            "min": stats.get(f"{idx}_min"),
            "max": stats.get(f"{idx}_max"),
        }
    return indices_stats, _generar_visuales(region, compuesto)


def _to_decimal(obj):
    """DynamoDB no acepta floats: convierte todo a Decimal."""
    return json.loads(json.dumps(obj), parse_float=Decimal)


def handler(event, context):
    """Trigger SQS. Por cada zona: calcula indices con Sentinel-2 y encola al LLM."""
    # Clientes y variables de entorno DENTRO del handler:
    # asi importar el modulo no requiere nada de AWS (testeable en local).
    table = boto3.resource("dynamodb").Table(os.environ["JOBS_TABLE"])
    sqs = boto3.client("sqs")
    llm_queue_url = os.environ["LLM_QUEUE_URL"]
    failures = []

    for record in event["Records"]:
        message_id = record.get("messageId")
        try:
            msg = json.loads(record["body"])
            indices_stats, visual_assets = analizar_lote(
                msg["geometry"], msg["indices"],
                msg["date_start"], msg["date_end"],
            )

            # Guarda los indices crudos en DynamoDB
            table.update_item(
                Key={"job_id": msg["job_id"]},
                UpdateExpression="SET #s = :s, indices_stats = :idx, visual_assets = :v",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={
                    ":s": "PROCESSING",
                    ":idx": _to_decimal(indices_stats),
                    ":v": visual_assets,
                },
            )

            # Encola para que el LLM lo interprete
            sqs.send_message(
                QueueUrl=llm_queue_url,
                MessageBody=json.dumps({
                    "job_id": msg["job_id"],
                    "analysis_id": msg.get("analysis_id"),
                    "tenant_id": msg.get("tenant_id"),
                    "parcel_id": msg.get("parcel_id"),
                    "collection_id": msg.get("collection_id"),
                    "crop_type": msg.get("crop_type"),
                    "area_ha": msg.get("area_ha"),
                    "area_m2": msg.get("area_m2"),
                    "zona": msg["zona"],
                    "indices": indices_stats,
                    "visual_assets": visual_assets,
                    "date_start": msg.get("date_start"),
                    "date_end": msg.get("date_end"),
                }),
            )
            print(f"Indices calculados para zona {msg.get('zona')}.")

        except Exception as e:
            # Cualquier fallo -> la zona vuelve a la cola y, tras N intentos, a la DLQ.
            print(f"Error en satelite {message_id}: {e}")
            failures.append({"itemIdentifier": message_id})

    return {"batchItemFailures": failures}
