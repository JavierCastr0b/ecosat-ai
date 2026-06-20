import os
import json
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

from shared.auth import require_auth


CORS = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}


def _response(status, body):
    return {"statusCode": status, "headers": CORS, "body": json.dumps(body)}


def _decimal_to_float(obj):
    """DynamoDB devuelve Decimals; JSON no los serializa -> convertir a float."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: _decimal_to_float(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_decimal_to_float(i) for i in obj]
    return obj


def handler(event, context):
    """GET /analysis/{id}/status — polling del frontend.

    Consulta el GSI analysis_id-index para obtener todos los jobs
    del analisis y devuelve el estado agregado + resultados por zona.
    """
    table = boto3.resource("dynamodb").Table(os.environ["JOBS_TABLE"])
    analysis_id = (event.get("pathParameters") or {}).get("id", "")

    if not analysis_id:
        return _response(400, {"error": "analysis_id requerido"})

    resp = table.query(
        IndexName="analysis_id-index",
        KeyConditionExpression=Key("analysis_id").eq(analysis_id),
    )
    items = resp.get("Items", [])

    if not items:
        return _response(404, {"error": "analysis no encontrado"})

    tenant_ids = {item.get("tenant_id") for item in items if item.get("tenant_id")}
    if tenant_ids:
        auth, auth_error = require_auth(event)
        if auth_error:
            return auth_error
        if auth["tenant_id"] not in tenant_ids:
            return _response(403, {"error": "analysis no pertenece al usuario"})

    # Estado agregado: FAILED si alguna fallo, COMPLETED si todas terminaron,
    # PROCESSING si hay alguna en curso o completada, PENDING si ninguna empezo.
    estados = {item.get("status") for item in items}
    if "FAILED" in estados:
        estado_global = "FAILED"
    elif estados == {"COMPLETED"}:
        estado_global = "COMPLETED"
    elif "PROCESSING" in estados or "COMPLETED" in estados:
        estado_global = "PROCESSING"
    else:
        estado_global = "PENDING"

    total = len(items)
    completadas = sum(1 for i in items if i.get("status") == "COMPLETED")

    zonas = []
    for item in items:
        zona = {
            "job_id": item.get("job_id"),
            "zona": item.get("zona"),
            "status": item.get("status"),
        }
        for field in ("tenant_id", "parcel_id", "collection_id", "source"):
            if field in item:
                zona[field] = item[field]
        if "indices_stats" in item:
            zona["indices_stats"] = _decimal_to_float(item["indices_stats"])
        if "interpretacion_ia" in item:
            zona["interpretacion_ia"] = item["interpretacion_ia"]
        zonas.append(zona)

    return _response(200, {
        "analysis_id": analysis_id,
        "status": estado_global,
        "progreso": {"completadas": completadas, "total": total},
        "zonas": zonas,
    })
