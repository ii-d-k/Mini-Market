"""Rutas del administrador: inicio de sesión, inventario y resumen."""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from ..auth import crear_token, password_correcta, requiere_admin
from ..database import DB
from ..errores import ErrorNegocio
from ..models import Cliente, Pedido, Producto
from ..schemas import Inventario, Login, Resumen, Token

router = APIRouter(prefix="/api/admin", tags=["Administración"])


@router.post("/login", response_model=Token, summary="Iniciar sesión de administrador")
def login(datos: Login):
    if not password_correcta(datos.password):
        raise ErrorNegocio("Contraseña incorrecta", 401)
    token, expira = crear_token()
    return Token(token=token, expira_en=expira)


@router.get(
    "/inventario",
    response_model=Inventario,
    dependencies=[Depends(requiere_admin)],
    summary="Estado del inventario",
)
def inventario(db: DB):
    productos = db.scalars(
        select(Producto)
        .options(selectinload(Producto.categoria))
        .order_by(Producto.stock, Producto.nombre)
    ).all()
    return Inventario(
        productos=productos,
        total_unidades=sum(p.stock for p in productos),
        valor_inventario=round(sum(p.stock * p.precio for p in productos), 2),
        productos_bajo_stock=sum(1 for p in productos if p.stock <= p.stock_minimo),
    )


@router.get(
    "/resumen",
    response_model=Resumen,
    dependencies=[Depends(requiere_admin)],
    summary="Resumen general de la tienda",
)
def resumen(db: DB):
    def contar(modelo):
        return db.scalar(select(func.count()).select_from(modelo))

    por_estado = dict(
        db.execute(select(Pedido.estado, func.count()).group_by(Pedido.estado)).all()
    )
    ventas = db.scalar(
        select(func.coalesce(func.sum(Pedido.total), 0)).where(Pedido.estado != "cancelado")
    )
    bajo_stock = db.scalars(
        select(Producto)
        .options(selectinload(Producto.categoria))
        .where(Producto.stock <= Producto.stock_minimo)
        .order_by(Producto.stock)
    ).all()
    ultimos = db.scalars(
        select(Pedido)
        .options(selectinload(Pedido.cliente), selectinload(Pedido.detalles))
        .order_by(Pedido.fecha.desc(), Pedido.id.desc())
        .limit(5)
    ).all()

    return Resumen(
        total_productos=contar(Producto),
        total_clientes=contar(Cliente),
        total_pedidos=contar(Pedido),
        ventas_totales=round(ventas, 2),
        pedidos_por_estado={
            estado: por_estado.get(estado, 0)
            for estado in ("pendiente", "enviado", "entregado", "cancelado")
        },
        bajo_stock=bajo_stock,
        ultimos_pedidos=ultimos,
    )
