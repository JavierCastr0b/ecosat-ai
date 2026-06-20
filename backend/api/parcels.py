import uuid

from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Attr, Key

from shared.auth import (
    now_iso,
    parse_body,
    require_auth,
    response,
    table,
    to_decimal,
)


def _collection_exists(tenant_id, collection_id):
    resp = table("COLLECTIONS_TABLE").get_item(
        Key={"tenant_id": tenant_id, "collection_id": collection_id}
    )
    return "Item" in resp


def _validate_geometry(geometry):
    if not isinstance(geometry, dict):
        return "geometry debe ser un objeto GeoJSON"
    if geometry.get("type") != "Polygon":
        return "por ahora solo se soporta GeoJSON Polygon"
    coordinates = geometry.get("coordinates")
    if not coordinates or not isinstance(coordinates, list):
        return "geometry.coordinates requerido"
    return None


def list_parcels(event, context):
    auth, error = require_auth(event)
    if error:
        return error

    params = event.get("queryStringParameters") or {}
    collection_id = params.get("collection_id")

    query_kwargs = {
        "KeyConditionExpression": Key("tenant_id").eq(auth["tenant_id"]),
    }
    if collection_id:
        query_kwargs["FilterExpression"] = Attr("collection_id").eq(collection_id)

    resp = table("PARCELS_TABLE").query(**query_kwargs)
    parcels = sorted(resp.get("Items", []), key=lambda item: item.get("created_at", ""))
    return response(200, {"parcels": parcels})


def create_parcel(event, context):
    auth, error = require_auth(event)
    if error:
        return error

    body, body_error = parse_body(event)
    if body_error:
        return body_error

    collection_id = body.get("collection_id")
    name = (body.get("name") or "").strip()
    geometry = body.get("geometry")

    if not collection_id:
        return response(400, {"error": "collection_id requerido"})
    if not _collection_exists(auth["tenant_id"], collection_id):
        return response(404, {"error": "coleccion no encontrada"})
    if not name:
        return response(400, {"error": "name requerido"})

    geometry_error = _validate_geometry(geometry)
    if geometry_error:
        return response(400, {"error": geometry_error})

    now = now_iso()
    item = {
        "tenant_id": auth["tenant_id"],
        "parcel_id": str(uuid.uuid4()),
        "collection_id": collection_id,
        "name": name,
        "geometry": to_decimal(geometry),
        "crop_type": (body.get("crop_type") or "").strip(),
        "notes": (body.get("notes") or "").strip(),
        "created_at": now,
        "updated_at": now,
    }
    table("PARCELS_TABLE").put_item(Item=item)
    return response(201, item)


def get_parcel(event, context):
    auth, error = require_auth(event)
    if error:
        return error

    parcel_id = (event.get("pathParameters") or {}).get("parcel_id")
    resp = table("PARCELS_TABLE").get_item(
        Key={"tenant_id": auth["tenant_id"], "parcel_id": parcel_id}
    )
    if "Item" not in resp:
        return response(404, {"error": "parcela no encontrada"})
    return response(200, resp["Item"])


def update_parcel(event, context):
    auth, error = require_auth(event)
    if error:
        return error

    parcel_id = (event.get("pathParameters") or {}).get("parcel_id")
    body, body_error = parse_body(event)
    if body_error:
        return body_error

    allowed = {
        "name": "name",
        "geometry": "geometry",
        "crop_type": "crop_type",
        "notes": "notes",
    }
    updates = []
    names = {}
    values = {":updated_at": now_iso()}

    for field, attr_name in allowed.items():
        if field not in body:
            continue
        value = body.get(field)
        if field == "name":
            value = (value or "").strip()
            if not value:
                return response(400, {"error": "name no puede estar vacio"})
        if field == "geometry":
            geometry_error = _validate_geometry(value)
            if geometry_error:
                return response(400, {"error": geometry_error})
            value = to_decimal(value)
        if field in {"crop_type", "notes"}:
            value = (value or "").strip()

        placeholder_name = f"#{attr_name}"
        placeholder_value = f":{attr_name}"
        updates.append(f"{placeholder_name} = {placeholder_value}")
        names[placeholder_name] = attr_name
        values[placeholder_value] = value

    if not updates:
        return response(400, {"error": "no hay campos para actualizar"})

    updates.append("updated_at = :updated_at")
    try:
        resp = table("PARCELS_TABLE").update_item(
            Key={"tenant_id": auth["tenant_id"], "parcel_id": parcel_id},
            UpdateExpression="SET " + ", ".join(updates),
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ConditionExpression="attribute_exists(parcel_id)",
            ReturnValues="ALL_NEW",
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return response(404, {"error": "parcela no encontrada"})
        raise
    return response(200, resp["Attributes"])


def delete_parcel(event, context):
    auth, error = require_auth(event)
    if error:
        return error

    parcel_id = (event.get("pathParameters") or {}).get("parcel_id")
    table("PARCELS_TABLE").delete_item(
        Key={"tenant_id": auth["tenant_id"], "parcel_id": parcel_id}
    )
    return response(200, {"ok": True})
