import uuid

from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key

from shared.auth import now_iso, parse_body, require_auth, response, table


def list_collections(event, context):
    auth, error = require_auth(event)
    if error:
        return error

    resp = table("COLLECTIONS_TABLE").query(
        KeyConditionExpression=Key("tenant_id").eq(auth["tenant_id"])
    )
    items = sorted(resp.get("Items", []), key=lambda item: item.get("created_at", ""))
    return response(200, {"collections": items})


def create_collection(event, context):
    auth, error = require_auth(event)
    if error:
        return error

    body, body_error = parse_body(event)
    if body_error:
        return body_error

    name = (body.get("name") or "").strip()
    if not name:
        return response(400, {"error": "name requerido"})

    now = now_iso()
    item = {
        "tenant_id": auth["tenant_id"],
        "collection_id": str(uuid.uuid4()),
        "name": name,
        "description": (body.get("description") or "").strip(),
        "created_at": now,
        "updated_at": now,
    }
    table("COLLECTIONS_TABLE").put_item(Item=item)
    return response(201, item)


def update_collection(event, context):
    auth, error = require_auth(event)
    if error:
        return error

    collection_id = (event.get("pathParameters") or {}).get("collection_id")
    body, body_error = parse_body(event)
    if body_error:
        return body_error

    updates = []
    names = {}
    values = {":updated_at": now_iso()}

    if "name" in body:
        name = (body.get("name") or "").strip()
        if not name:
            return response(400, {"error": "name no puede estar vacio"})
        updates.append("#name = :name")
        names["#name"] = "name"
        values[":name"] = name

    if "description" in body:
        updates.append("description = :description")
        values[":description"] = (body.get("description") or "").strip()

    if not updates:
        return response(400, {"error": "no hay campos para actualizar"})

    updates.append("updated_at = :updated_at")
    update_kwargs = {
        "Key": {"tenant_id": auth["tenant_id"], "collection_id": collection_id},
        "UpdateExpression": "SET " + ", ".join(updates),
        "ExpressionAttributeValues": values,
        "ConditionExpression": "attribute_exists(collection_id)",
        "ReturnValues": "ALL_NEW",
    }
    if names:
        update_kwargs["ExpressionAttributeNames"] = names

    try:
        resp = table("COLLECTIONS_TABLE").update_item(**update_kwargs)
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return response(404, {"error": "coleccion no encontrada"})
        raise
    return response(200, resp["Attributes"])


def delete_collection(event, context):
    auth, error = require_auth(event)
    if error:
        return error

    collection_id = (event.get("pathParameters") or {}).get("collection_id")
    table("COLLECTIONS_TABLE").delete_item(
        Key={"tenant_id": auth["tenant_id"], "collection_id": collection_id}
    )
    return response(200, {"ok": True})
