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
DEFAULT_HISTORY_LIMIT = 12


sqs = boto3.client("sqs")
s3 = boto3.client("s3")


PRIORITY_SCORE = {"alta": 3, "media": 2, "baja": 1}


def _metric_means(indices_stats):
    return {
        index_name: values.get("mean")
        for index_name, values in (indices_stats or {}).items()
        if isinstance(values, dict)
    }


def _metric_trend(current, previous):
    if not current or not previous:
        return {}

    trend = {}
    current_metrics = _metric_means(current.get("indices_stats"))
    previous_metrics = _metric_means(previous.get("indices_stats"))
    for index_name, value in current_metrics.items():
        old_value = previous_metrics.get(index_name)
        if value is None or old_value in (None, 0):
            continue
        delta = value - old_value
        pct = (delta / abs(old_value)) * 100
        trend[index_name] = {
            "delta": delta,
            "percent": pct,
            "direction": "sube" if delta > 0 else "baja" if delta < 0 else "estable",
        }
    return trend


def _compact_analysis(item, previous=None):
    interpretation = item.get("interpretacion_ia") or {}
    return {
        "analysis_record_id": item.get("analysis_record_id"),
        "analysis_id": item.get("analysis_id"),
        "job_id": item.get("job_id"),
        "parcel_id": item.get("parcel_id"),
        "collection_id": item.get("collection_id"),
        "zona": item.get("zona"),
        "date_start": item.get("date_start"),
        "date_end": item.get("date_end"),
        "created_at": item.get("created_at"),
        "metrics": _metric_means(item.get("indices_stats")),
        "trend": _metric_trend(item, previous),
        "estado_cultivo": interpretation.get("estado_cultivo"),
        "humedad": interpretation.get("humedad"),
        "nutricion": interpretation.get("nutricion"),
        "prioridad": interpretation.get("prioridad"),
        "confianza": interpretation.get("confianza"),
        "resumen": interpretation.get("resumen"),
        "recomendaciones": interpretation.get("recomendaciones", []),
        "acciones_inmediatas": interpretation.get("acciones_inmediatas", []),
        "plan_temporada": interpretation.get("plan_temporada", []),
        "limitaciones": interpretation.get("limitaciones"),
    }


def _history_series(analyses):
    sorted_items = sorted(analyses, key=lambda item: item.get("date_end") or "")
    series = {}
    for item in sorted_items:
        label = item.get("date_end") or item.get("created_at")
        for index_name, value in _metric_means(item.get("indices_stats")).items():
            series.setdefault(index_name, []).append({
                "date": label,
                "value": value,
                "analysis_id": item.get("analysis_id"),
            })
    return series


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
                "crop_type": parcel.get("crop_type"),
                "area_ha": json_ready(parcel.get("area_ha")),
                "area_m2": json_ready(parcel.get("area_m2")),
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
    params = event.get("queryStringParameters") or {}
    compact = params.get("compact") == "true"
    try:
        limit = int(params.get("limit", DEFAULT_HISTORY_LIMIT))
    except ValueError:
        return response(400, {"error": "limit debe ser numerico"})

    analyses = sorted(
        resp.get("Items", []),
        key=lambda item: item.get("created_at", ""),
        reverse=True,
    )
    if limit > 0:
        analyses = analyses[:limit]
    if compact:
        compact_items = [
            _compact_analysis(item, analyses[index + 1] if index + 1 < len(analyses) else None)
            for index, item in enumerate(analyses)
        ]
        return response(200, {
            "parcel_id": parcel_id,
            "total": len(analyses),
            "latest": compact_items[0] if compact_items else None,
            "series": _history_series(analyses),
            "analyses": compact_items,
        })
    return response(200, {"analyses": analyses})


def get_parcel_summary(event, context):
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
    recent = analyses[:DEFAULT_HISTORY_LIMIT]
    return response(200, {
        "parcel_id": parcel_id,
        "has_analysis": bool(analyses),
        "latest": _compact_analysis(analyses[0], analyses[1] if len(analyses) > 1 else None) if analyses else None,
        "series": _history_series(recent),
    })


def _collection_rankings(summaries):
    analyzed = [item for item in summaries if item.get("latest")]
    by_priority = sorted(
        analyzed,
        key=lambda item: PRIORITY_SCORE.get(item["latest"].get("prioridad"), 0),
        reverse=True,
    )
    by_water_stress = sorted(
        analyzed,
        key=lambda item: (item["latest"].get("metrics") or {}).get("NDMI", 999),
    )
    by_vigor = sorted(
        analyzed,
        key=lambda item: (item["latest"].get("metrics") or {}).get("NDVI", -999),
        reverse=True,
    )
    by_nutrition = sorted(
        analyzed,
        key=lambda item: (item["latest"].get("metrics") or {}).get("NDRE", 999),
    )
    return {
        "prioridad": by_priority[:5],
        "estres_hidrico": by_water_stress[:5],
        "mejor_vigor": by_vigor[:5],
        "nutricion_baja": by_nutrition[:5],
    }


def get_collection_summary(event, context):
    auth, error = require_auth(event)
    if error:
        return error

    collection_id = (event.get("pathParameters") or {}).get("collection_id")
    parcels = _get_parcels(auth["tenant_id"], collection_id=collection_id)
    summaries = []
    priority_counts = {"alta": 0, "media": 0, "baja": 0, "sin_datos": 0}

    analyses_table = table("PARCEL_ANALYSES_TABLE")
    for parcel in parcels:
        resp = analyses_table.query(
            IndexName="tenant-parcel-index",
            KeyConditionExpression=(
                Key("tenant_id").eq(auth["tenant_id"])
                & Key("parcel_id").eq(parcel["parcel_id"])
            ),
        )
        analyses = sorted(
            resp.get("Items", []),
            key=lambda item: item.get("created_at", ""),
            reverse=True,
        )
        latest = _compact_analysis(analyses[0], analyses[1] if len(analyses) > 1 else None) if analyses else None
        priority = (latest or {}).get("prioridad") or "sin_datos"
        if priority not in priority_counts:
            priority = "sin_datos"
        priority_counts[priority] += 1
        summaries.append({
            "parcel_id": parcel["parcel_id"],
            "name": parcel.get("name"),
            "crop_type": parcel.get("crop_type"),
            "area_m2": parcel.get("area_m2"),
            "area_ha": parcel.get("area_ha"),
            "latest": latest,
        })

    return response(200, {
        "collection_id": collection_id,
        "total_parcels": len(parcels),
        "priority_counts": priority_counts,
        "rankings": _collection_rankings(summaries),
        "parcels": summaries,
    })
