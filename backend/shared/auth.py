import base64
import hashlib
import hmac
import json
import os
import secrets
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import boto3


CORS = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7
PASSWORD_ITERATIONS = 120_000


def response(status, body):
    return {"statusCode": status, "headers": CORS, "body": json.dumps(_to_json(body))}


def to_decimal(obj):
    return json.loads(json.dumps(obj), parse_float=Decimal)


def json_ready(obj):
    return _to_json(obj)


def _to_json(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {key: _to_json(value) for key, value in obj.items()}
    if isinstance(obj, list):
        return [_to_json(value) for value in obj]
    return obj


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def now_epoch():
    return int(datetime.now(timezone.utc).timestamp())


def parse_body(event):
    try:
        return json.loads(event.get("body") or "{}"), None
    except json.JSONDecodeError:
        return None, response(400, {"error": "body no es JSON valido"})


def table(name):
    return boto3.resource("dynamodb").Table(os.environ[name])


def _b64(data):
    return base64.b64encode(data).decode("ascii")


def _b64decode(data):
    return base64.b64decode(data.encode("ascii"))


def hash_password(password, salt=None):
    if salt is None:
        salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_ITERATIONS,
    )
    return {
        "salt": _b64(salt),
        "password_hash": _b64(digest),
        "password_iterations": PASSWORD_ITERATIONS,
    }


def verify_password(password, user):
    expected = _b64decode(user["password_hash"])
    salt = _b64decode(user["salt"])
    iterations = int(user.get("password_iterations", PASSWORD_ITERATIONS))
    actual = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    )
    return hmac.compare_digest(actual, expected)


def hash_token(secret):
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def create_session(tenant_id, user_email):
    token_id = str(uuid.uuid4())
    secret = secrets.token_urlsafe(32)
    token = f"{token_id}.{secret}"
    expires_at = now_epoch() + TOKEN_TTL_SECONDS

    table("AUTH_TOKENS_TABLE").put_item(Item={
        "tenant_id": tenant_id,
        "token_id": token_id,
        "token_hash": hash_token(secret),
        "user_email": user_email,
        "created_at": now_iso(),
        "expires_at": expires_at,
    })
    return token, expires_at


def _get_header(headers, name):
    if not headers:
        return ""
    target = name.lower()
    for key, value in headers.items():
        if key.lower() == target:
            return value or ""
    return ""


def require_auth(event):
    headers = event.get("headers") or {}
    tenant_id = _get_header(headers, "x-tenant-id")
    auth_header = _get_header(headers, "authorization")

    if not tenant_id:
        return None, response(401, {"error": "header X-Tenant-Id requerido"})
    if not auth_header.startswith("Bearer "):
        return None, response(401, {"error": "Authorization Bearer token requerido"})

    token = auth_header.replace("Bearer ", "", 1).strip()
    if "." not in token:
        return None, response(401, {"error": "token invalido"})

    token_id, secret = token.split(".", 1)
    token_resp = table("AUTH_TOKENS_TABLE").get_item(
        Key={"tenant_id": tenant_id, "token_id": token_id}
    )
    session = token_resp.get("Item")
    if not session:
        return None, response(401, {"error": "sesion no encontrada"})
    if int(session.get("expires_at", 0)) < now_epoch():
        return None, response(401, {"error": "sesion expirada"})
    if not hmac.compare_digest(session.get("token_hash", ""), hash_token(secret)):
        return None, response(401, {"error": "token invalido"})

    return {
        "tenant_id": tenant_id,
        "token_id": token_id,
        "user_email": session.get("user_email"),
    }, None
