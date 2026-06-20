import os
import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from groq import Groq, RateLimitError

# Modelo de Groq. Revisa los IDs vigentes en https://console.groq.com/docs/models
# porque rotan cada cierto tiempo.
GROQ_MODEL = "llama-3.3-70b-versatile"

groq_client = Groq(api_key=os.environ["GROQ_API_KEY"])

SYSTEM_PROMPT = """Eres un asesor agricola experto en teledeteccion satelital.
Recibes indices calculados sobre una parcela o plantacion agricola en Peru y
debes interpretarlos para una audiencia NO tecnica: agricultores, cooperativas
o tecnicos de campo.

Significado de los indices:
- NDVI: vigor y biomasa del cultivo (mas alto = cultivo mas vigoroso).
- NDMI: humedad del cultivo (mas bajo = posible estres hidrico).
- NDRE: clorofila/estado nutricional; ayuda a detectar falta de nitrogeno y
  fertilizacion insuficiente, especialmente en cultivos densos.
- SAVI: vigor corregido por suelo visible; util en cultivos jovenes, ralos o con
  surcos expuestos, donde el NDVI puede distorsionarse.

Reglas de interpretacion:
- Prioriza recomendaciones accionables de riego, fertilizacion y monitoreo.
- Explica en lenguaje simple, sin jerga y sin exagerar precision.
- Si hay pocos datos o los valores no son concluyentes, dilo con honestidad.
- Considera limitaciones de Sentinel-2: resolucion de 10-20 m y posible nubosidad.
- No inventes pronosticos climaticos. Si te preguntan por clima futuro, explica
  que estos indices muestran condicion actual/reciente del cultivo y recomienda
  cruzarlos con pronostico meteorologico o lluvia observada.
- Usa los valores mean/min/max para detectar variabilidad dentro de la parcela:
  una diferencia grande entre min y max sugiere manejo por sectores.

Responde SIEMPRE en espanol y SOLO con un objeto JSON valido con esta estructura
exacta, sin texto adicional fuera del JSON:
{
  "estado_cultivo": "<bajo|moderado|alto>",
  "humedad": "<baja|media|alta>",
  "nutricion": "<deficiente|media|buena|no_disponible>",
  "prioridad": "<baja|media|alta>",
  "resumen": "<3-5 frases claras y entendibles>",
  "diagnostico_indices": {
    "NDVI": "<que indica el vigor y donde podria haber problema>",
    "NDMI": "<que indica la humedad y si hay estres hidrico>",
    "NDRE": "<que indica la nutricion/clorofila o no_disponible>",
    "SAVI": "<que indica el efecto del suelo/cultivo joven o no_disponible>"
  },
  "recomendaciones": ["<accion prioritaria 1>", "<accion prioritaria 2>", "<accion prioritaria 3>"],
  "acciones_inmediatas": ["<accion 1>", "<accion 2>", "<accion 3>"],
  "plan_temporada": ["<seguimiento 1>", "<seguimiento 2>", "<seguimiento 3>"],
  "datos_adicionales_recomendados": ["<dato 1>", "<dato 2>"],
  "limitaciones": "<explica brevemente nubosidad/resolucion y que no es pronostico climatico>",
  "confianza": "<baja|media|alta>"
}"""


def interpretar_indices(zona, indices):
    """Llama a Groq y devuelve la interpretacion agricola como dict.

    Funcion pura: solo necesita la API de Groq, NO toca AWS.
    Por eso se puede testear en local sin credenciales.
    """
    user_prompt = (
        f"Zona analizada: {zona}\n"
        f"Indices calculados (estadisticas): {json.dumps(indices)}\n\n"
        f"Interpreta estos valores y devuelve el JSON solicitado."
    )

    resp = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content)


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _to_decimal(obj):
    return json.loads(json.dumps(obj), parse_float=Decimal)


def handler(event, context):
    """Trigger SQS. Por cada zona: interpreta con Groq y guarda en DynamoDB.

    Usa partial batch response (batchItemFailures): si una zona falla,
    SOLO esa vuelve a la cola, no se reprocesan las que ya quedaron COMPLETED.
    Tras maxReceiveCount, la zona fallida cae a la DLQ sin perder data.
    """
    table = boto3.resource("dynamodb").Table(os.environ["JOBS_TABLE"])
    failures = []

    for record in event["Records"]:
        message_id = record.get("messageId")
        try:
            msg = json.loads(record["body"])
            interpretacion = interpretar_indices(msg["zona"], msg["indices"])

            table.update_item(
                Key={"job_id": msg["job_id"]},
                UpdateExpression="SET #s = :s, interpretacion_ia = :i",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={
                    ":s": "COMPLETED",
                    ":i": interpretacion,
                },
            )

            if msg.get("tenant_id") and msg.get("parcel_id"):
                history_table = boto3.resource("dynamodb").Table(
                    os.environ["PARCEL_ANALYSES_TABLE"]
                )
                history_table.put_item(Item={
                    "tenant_id": msg["tenant_id"],
                    "analysis_record_id": str(uuid.uuid4()),
                    "analysis_id": msg.get("analysis_id"),
                    "job_id": msg["job_id"],
                    "parcel_id": msg["parcel_id"],
                    "collection_id": msg.get("collection_id"),
                    "zona": msg.get("zona"),
                    "date_start": msg.get("date_start"),
                    "date_end": msg.get("date_end"),
                    "indices_stats": _to_decimal(msg["indices"]),
                    "interpretacion_ia": interpretacion,
                    "created_at": _now_iso(),
                })
            print(f"Zona {msg.get('zona')} interpretada y guardada.")

        except RateLimitError as e:
            # 429 de Groq: la zona vuelve a la cola para reintentarse mas tarde.
            print(f"Rate limit de Groq en {message_id}, se reintentara: {e}")
            failures.append({"itemIdentifier": message_id})

        except Exception as e:
            # Cualquier otro fallo tambien se reintenta via cola.
            print(f"Error procesando {message_id}: {e}")
            failures.append({"itemIdentifier": message_id})

    return {"batchItemFailures": failures}
