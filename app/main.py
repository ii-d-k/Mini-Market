"""Punto de entrada de la API de MiniMarket."""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError

from .config import FRONTEND_DIR
from .datos_iniciales import inicializar_base_datos
from .errores import ErrorNegocio
from .routers import admin, categorias, clientes, pedidos, productos

# Se ejecuta al importar para que también funcione en Vercel.
inicializar_base_datos()

app = FastAPI(
    title="MiniMarket API",
    version="1.0.0",
    description=(
        "API de la tienda en línea MiniMarket: catálogo, carrito, pedidos e inventario.\n\n"
        "Las rutas de administración requieren un token: obténgalo en "
        "`POST /api/admin/login` y péguelo en el botón **Authorize**."
    ),
)


@app.exception_handler(ErrorNegocio)
async def manejar_error_negocio(_request: Request, error: ErrorNegocio):
    return JSONResponse(status_code=error.codigo, content={"detail": error.mensaje})


@app.exception_handler(IntegrityError)
async def manejar_error_integridad(_request: Request, _error: IntegrityError):
    return JSONResponse(
        status_code=409,
        content={"detail": "La operación entra en conflicto con datos existentes"},
    )


@app.exception_handler(RequestValidationError)
async def manejar_error_validacion(_request: Request, error: RequestValidationError):
    mensajes = []
    for err in error.errors():
        campo = ".".join(str(parte) for parte in err["loc"] if parte not in ("body", "query", "path"))
        mensajes.append(f"{campo}: {err['msg']}" if campo else err["msg"])
    return JSONResponse(
        status_code=422,
        content={"detail": "Datos inválidos. " + "; ".join(mensajes)},
    )


@app.get("/api/salud", tags=["Sistema"], summary="Verificar que la API funciona")
def salud():
    return {"estado": "ok"}


app.include_router(productos.router)
app.include_router(categorias.router)
app.include_router(pedidos.router)
app.include_router(clientes.router)
app.include_router(admin.router)

# El frontend se sirve desde el mismo servidor (va al final para no tapar la API).
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
