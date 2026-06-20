import os
import json
from decimal import Decimal

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


def calcular_indices(geometry, indices, date_start, date_end):
    """Consulta Sentinel-2 en GEE y devuelve mean/min/max de cada indice.

    Solo necesita credenciales de GEE, NO toca AWS -> testeable en local.
    """
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

    resultado = {}
    for idx in indices:
        if idx in INDEX_BANDS:
            a, b = INDEX_BANDS[idx]
            index_image = compuesto.normalizedDifference([a, b]).rename(idx)
        elif idx == "SAVI":
            # SAVI corrige el efecto del suelo visible en cultivos jovenes o ralos.
            index_image = compuesto.expression(
                "((nir - red) / (nir + red + 0.5)) * 1.5",
                {
                    "nir": compuesto.select("B8"),
                    "red": compuesto.select("B4"),
                },
            ).rename(idx)
        else:
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
            indices_stats = calcular_indices(
                msg["geometry"], msg["indices"],
                msg["date_start"], msg["date_end"],
            )

            # Guarda los indices crudos en DynamoDB
            table.update_item(
                Key={"job_id": msg["job_id"]},
                UpdateExpression="SET #s = :s, indices_stats = :idx",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={
                    ":s": "PROCESSING",
                    ":idx": _to_decimal(indices_stats),
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
                    "zona": msg["zona"],
                    "indices": indices_stats,
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
