import json
import os
import uuid

import boto3
from boto3.dynamodb.conditions import Key

from shared.auth import (
    json_ready,
    now_iso,
    parse_body,
    require_auth,
    response,
    table,
)


DEFAULT_INDICES = ["NDVI", "NDMI", "NDRE", "SAVI"]
MAX_BATCH_SIZE = 30


sqs = boto3.client("sqs")
s3 = boto3.client("s3")


def _get_parcels(tenant_id, parcel_ids=None, collection_id=None):
    parcels_table = table("PARCELS_TABLE")

    if parcel_ids:
        parcels = []
        for parcel_id in parcel_ids:
            resp = parcels_table.get_item(
                Key={"tenant_id": tenant_id, "parcel_id": parcel_id}
            )
            if "Item" in resp:
                parcels.append(resp["Item"])
        return parcels

    if collection_id:
        resp = parcels_table.query(
            KeyConditionExpression=Key("tenant_id").eq(tenant_id)
        )
        return [
            item for item in resp.get("Items", [])
            if item.get("collection_id") == collection_id
        ]

    return []


def create_saved_analysis(event, context):
    """POST /analysis/saved.

    Lanza un analisis masivo usando parcelas ya guardadas por el usuario.
    """
    auth, error = require_auth(event)
    if error:
        return error

    body, body_error = parse_body(event)
    if body_error:
        return body_error

    parcel_ids = body.get("parcel_ids") or []
    collection_id = body.get("collection_id")
    date_start = body.get("date_start")
    date_end = body.get("date_end")
    indices = body.get("indices") or DEFAULT_INDICES

    if not date_start or not date_end:
        return response(400, {"error": "date_start y date_end requeridos"})
    if parcel_ids and not isinstance(parcel_ids, list):
        return response(400, {"error": "parcel_ids debe ser una lista"})
    if not parcel_ids and not collection_id:
        return response(400, {"error": "parcel_ids o collection_id requerido"})

    parcels = _get_parcels(auth["tenant_id"], parcel_ids, collection_id)
    if not parcels:
        return response(404, {"error": "no se encontraron parcelas"})
    if len(parcels) > MAX_BATCH_SIZE:
        return response(400, {
            "error": f"maximo {MAX_BATCH_SIZE} parcelas por lote controlado",
        })

    analysis_id = str(uuid.uuid4())
    now = now_iso()
    jobs_table = table("JOBS_TABLE")
    job_ids = []

    for parcel in parcels:
        job_id = str(uuid.uuid4())
        zone_name = parcel.get("name", parcel["parcel_id"])
        geometry = json_ready(parcel["geometry"])

        s3.put_object(
            Bucket=os.environ["INPUTS_BUCKET"],
            Key=f"{analysis_id}/{job_id}.json",
            Body=json.dumps({
                "tenant_id": auth["tenant_id"],
                "parcel": json_ready(parcel),
            }),
        )

        jobs_table.put_item(Item={
            "job_id": job_id,
            "analysis_id": analysis_id,
            "tenant_id": auth["tenant_id"],
            "parcel_id": parcel["parcel_id"],
            "collection_id": parcel.get("collection_id"),
            "zona": zone_name,
            "status": "PENDING",
            "indices": indices,
            "date_start": date_start,
            "date_end": date_end,
            "created_at": now,
            "source": "SAVED_PARCEL",
        })

        sqs.send_message(
            QueueUrl=os.environ["SATELLITE_QUEUE_URL"],
            MessageBody=json.dumps({
                "job_id": job_id,
                "analysis_id": analysis_id,
                "tenant_id": auth["tenant_id"],
                "parcel_id": parcel["parcel_id"],
                "collection_id": parcel.get("collection_id"),
                "zona": zone_name,
                "geometry": geometry,
                "indices": indices,
                "date_start": date_start,
                "date_end": date_end,
            }),
        )
        job_ids.append(job_id)

    return response(202, {
        "analysis_id": analysis_id,
        "total_parcelas": len(job_ids),
        "job_ids": job_ids,
        "status": "PROCESSING",
    })


def list_parcel_analyses(event, context):
    auth, error = require_auth(event)
    if error:
        return error

    parcel_id = (event.get("pathParameters") or {}).get("parcel_id")
    resp = table("PARCEL_ANALYSES_TABLE").query(
        IndexName="tenant-parcel-index",
        KeyConditionExpression=(
            Key("tenant_id").eq(auth["tenant_id"]) & Key("parcel_id").eq(parcel_id)
        ),
    )
    analyses = sorted(
        resp.get("Items", []),
        key=lambda item: item.get("created_at", ""),
        reverse=True,
    )
    return response(200, {"analyses": analyses})
