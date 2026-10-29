"""Reinicia la base de datos: borra las tablas, las vuelve a crear y carga datos de ejemplo.

Uso (desde la carpeta del proyecto):
    python database/seed.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import DB_PATH  # noqa: E402
from app.database import Base, engine  # noqa: E402
from app.datos_iniciales import inicializar_base_datos  # noqa: E402

Base.metadata.drop_all(engine)
inicializar_base_datos()
with engine.connect() as conexion:
    conexion.exec_driver_sql("VACUUM")
print(f"Base de datos reiniciada con datos de ejemplo en: {DB_PATH}")
