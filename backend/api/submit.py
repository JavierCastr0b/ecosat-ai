import os
import json
import uuid
from datetime import datetime, timezone

import boto3

dynamodb = boto3.resource("dynamodb")
sqs = boto3.client("sqs")
s3 = boto3.client("s3")

JOBS_TABLE = os.environ["JOBS_TABLE"]
INPUTS_BUCKET = os.environ["INPUTS_BUCKET"]
SATELLITE_QUEUE_URL = os.environ["SATELLITE_QUEUE_URL"]

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Tenant-Id,x-tenant-id,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Content-Type": "application/json",
}


def _response(status, body):
    return {"statusCode": status, "headers": CORS, "body": json.dumps(body)}


def handler(event, context):
    """POST /analysis.

    Recibe una o varias zonas del frontend, crea el analisis y hace FAN-OUT:
    emite 1 mensaje independiente por zona hacia la cola satelital.
    Asi un lote de 20-30 zonas se procesa de forma asincrona y en paralelo.
    """
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "body no es JSON valido"})

    zonas = body.get("zonas", [])
    if not zonas:
        return _response(400, {"error": "se requiere al menos una zona en 'zonas'"})

    indices = body.get("indices", ["NDVI", "NDMI", "NDRE", "SAVI"])
    analysis_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    table = dynamodb.Table(JOBS_TABLE)
    job_ids = []

    for i, zona in enumerate(zonas):
        job_id = str(uuid.uuid4())
        zona_name = zona.get("name", f"zona-{i + 1}")

        # 1) Guarda el input (geometria de la zona) en S3
        s3.put_object(
            Bucket=INPUTS_BUCKET,
            Key=f"{analysis_id}/{job_id}.json",
            Body=json.dumps(zona),
        )

        # 2) Crea el registro del job en DynamoDB (estado inicial)
        table.put_item(Item={
            "job_id": job_id,
            "analysis_id": analysis_id,
            "zona": zona_name,
            "status": "PENDING",
            "indices": indices,
            "date_start": body.get("date_start"),
            "date_end": body.get("date_end"),
            "created_at": now,
        })

        # 3) FAN-OUT: 1 mensaje por zona hacia la cola satelital
        sqs.send_message(
            QueueUrl=SATELLITE_QUEUE_URL,
            MessageBody=json.dumps({
                "job_id": job_id,
                "zona": zona_name,
                "geometry": zona.get("geometry"),
                "indices": indices,
                "date_start": body.get("date_start"),
                "date_end": body.get("date_end"),
            }),
        )
        job_ids.append(job_id)

    return _response(202, {
        "analysis_id": analysis_id,
        "total_zonas": len(job_ids),
        "job_ids": job_ids,
        "status": "PROCESSING",
    })
