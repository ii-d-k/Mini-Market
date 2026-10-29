"""Acceso al panel de administración con un token firmado (sin estado)."""
import hashlib
import hmac
import time

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import ADMIN_PASSWORD, SECRET_KEY, TOKEN_HORAS
from .errores import ErrorNegocio

_bearer = HTTPBearer(auto_error=False, description="Token obtenido en /api/admin/login")


def _firmar(texto: str) -> str:
    return hmac.new(SECRET_KEY.encode(), texto.encode(), hashlib.sha256).hexdigest()


def password_correcta(password: str) -> bool:
    return hmac.compare_digest(password.encode(), ADMIN_PASSWORD.encode())


def crear_token() -> tuple[str, int]:
    expira = int(time.time()) + TOKEN_HORAS * 3600
    carga = f"admin.{expira}"
    return f"{carga}.{_firmar(carga)}", expira


def requiere_admin(credenciales: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> None:
    """Dependencia que protege las rutas del administrador."""
    if credenciales is None:
        raise ErrorNegocio("Debe iniciar sesión como administrador", 401)

    partes = credenciales.credentials.split(".")
    if len(partes) != 3:
        raise ErrorNegocio("Sesión inválida", 401)

    rol, expira, firma = partes
    firma_valida = hmac.compare_digest(firma, _firmar(f"{rol}.{expira}"))
    if not firma_valida or not expira.isdigit() or int(expira) < time.time():
        raise ErrorNegocio("La sesión expiró, vuelva a iniciar sesión", 401)
