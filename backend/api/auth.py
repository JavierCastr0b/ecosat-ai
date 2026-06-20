import uuid

from boto3.dynamodb.conditions import Key

from shared.auth import (
    create_session,
    hash_password,
    now_iso,
    parse_body,
    require_auth,
    response,
    table,
    verify_password,
)


def _clean_email(email):
    return (email or "").strip().lower()


def register(event, context):
    body, error = parse_body(event)
    if error:
        return error

    email = _clean_email(body.get("email"))
    password = body.get("password") or ""
    name = (body.get("name") or "").strip()

    if not email or "@" not in email:
        return response(400, {"error": "email valido requerido"})
    if len(password) < 8:
        return response(400, {"error": "password debe tener al menos 8 caracteres"})

    users = table("USERS_TABLE")
    existing = users.query(
        IndexName="email-index",
        KeyConditionExpression=Key("email").eq(email),
        Limit=1,
    )
    if existing.get("Items"):
        return response(409, {"error": "email ya registrado"})

    tenant_id = str(uuid.uuid4())
    password_data = hash_password(password)
    user = {
        "tenant_id": tenant_id,
        "email": email,
        "name": name or email.split("@", 1)[0],
        "status": "ACTIVE",
        "created_at": now_iso(),
        **password_data,
    }
    users.put_item(Item=user)

    token, expires_at = create_session(tenant_id, email)
    return response(201, {
        "tenant_id": tenant_id,
        "token": token,
        "expires_at": expires_at,
        "user": {
            "tenant_id": tenant_id,
            "email": email,
            "name": user["name"],
        },
    })


def login(event, context):
    body, error = parse_body(event)
    if error:
        return error

    email = _clean_email(body.get("email"))
    password = body.get("password") or ""

    users = table("USERS_TABLE")
    user_resp = users.query(
        IndexName="email-index",
        KeyConditionExpression=Key("email").eq(email),
        Limit=1,
    )
    items = user_resp.get("Items", [])
    if not items or not verify_password(password, items[0]):
        return response(401, {"error": "credenciales invalidas"})

    user = items[0]
    token, expires_at = create_session(user["tenant_id"], email)
    return response(200, {
        "tenant_id": user["tenant_id"],
        "token": token,
        "expires_at": expires_at,
        "user": {
            "tenant_id": user["tenant_id"],
            "email": user["email"],
            "name": user.get("name"),
        },
    })


def me(event, context):
    auth, error = require_auth(event)
    if error:
        return error

    user_resp = table("USERS_TABLE").get_item(Key={"tenant_id": auth["tenant_id"]})
    user = user_resp.get("Item")
    if not user:
        return response(404, {"error": "usuario no encontrado"})

    return response(200, {
        "tenant_id": user["tenant_id"],
        "email": user["email"],
        "name": user.get("name"),
        "status": user.get("status"),
        "created_at": user.get("created_at"),
    })


def logout(event, context):
    auth, error = require_auth(event)
    if error:
        return error

    table("AUTH_TOKENS_TABLE").delete_item(
        Key={"tenant_id": auth["tenant_id"], "token_id": auth["token_id"]}
    )
    return response(200, {"ok": True})
