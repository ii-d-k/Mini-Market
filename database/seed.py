"""Reinicia la base de datos: borra minimarket.db, crea las tablas y carga datos de ejemplo.

Uso (desde la carpeta del proyecto):
    python database/seed.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import DB_PATH  # noqa: E402

if DB_PATH.exists():
    DB_PATH.unlink()

from app.datos_iniciales import inicializar_base_datos  # noqa: E402

inicializar_base_datos()
print(f"Base de datos creada con datos de ejemplo en: {DB_PATH}")
