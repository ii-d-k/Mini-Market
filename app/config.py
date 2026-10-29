"""Configuración general de la aplicación."""
import os
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
DB_LOCAL = BASE_DIR / "database" / "minimarket.db"

# Vercel define la variable VERCEL. Allí solo se puede escribir en /tmp.
EN_VERCEL = bool(os.environ.get("VERCEL"))


def _ruta_base_datos() -> Path:
    """Devuelve la ruta del archivo SQLite que usará la app."""
    ruta_personalizada = os.environ.get("MINIMARKET_DB")
    if ruta_personalizada:
        return Path(ruta_personalizada)

    if EN_VERCEL:
        # Se copia la base incluida en el repositorio a /tmp para poder escribir.
        destino = Path("/tmp/minimarket.db")
        destino.parent.mkdir(parents=True, exist_ok=True)
        if not destino.exists() and DB_LOCAL.exists():
            shutil.copy(DB_LOCAL, destino)
        return destino

    return DB_LOCAL


DB_PATH = _ruta_base_datos()

# Credenciales del panel de administración (cámbielas con variables de entorno).
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
SECRET_KEY = os.environ.get("SECRET_KEY", "minimarket-clave-de-desarrollo")
TOKEN_HORAS = 8
