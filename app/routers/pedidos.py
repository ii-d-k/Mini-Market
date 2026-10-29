"""Rutas de pedidos: registrar, consultar, cambiar estado y eliminar."""
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..auth import requiere_admin
from ..database import DB
from ..errores import obtener_o_404
from ..models import Cliente, Pedido
from ..schemas import EstadoPedido, PedidoActualizar, PedidoEntrada, PedidoSalida
from ..services import pedidos as servicio

router = APIRouter(prefix="/api/pedidos", tags=["Pedidos"])


def _consulta_pedidos():
    return (
        select(Pedido)
        .options(selectinload(Pedido.cliente), selectinload(Pedido.detalles))
        .order_by(Pedido.fecha.desc(), Pedido.id.desc())
    )


@router.post("", response_model=PedidoSalida, status_code=201, summary="Registrar pedido (checkout)")
def crear_pedido(datos: PedidoEntrada, db: DB):
    return servicio.crear_pedido(db, datos)


@router.get("/buscar", response_model=list[PedidoSalida], summary="Consultar pedidos por email")
def buscar_por_email(db: DB, email: str = Query(min_length=3)):
    consulta = _consulta_pedidos().join(Pedido.cliente).where(
        Cliente.email == email.strip().lower()
    )
    return db.scalars(consulta).all()


@router.get(
    "",
    response_model=list[PedidoSalida],
    dependencies=[Depends(requiere_admin)],
    summary="Listar todos los pedidos",
)
def listar_pedidos(
    db: DB,
    estado: EstadoPedido | None = Query(default=None),
    cliente_id: int | None = Query(default=None),
):
    consulta = _consulta_pedidos()
    if estado:
        consulta = consulta.where(Pedido.estado == estado)
    if cliente_id is not None:
        consulta = consulta.where(Pedido.cliente_id == cliente_id)
    return db.scalars(consulta).all()


@router.get(
    "/{pedido_id}",
    response_model=PedidoSalida,
    dependencies=[Depends(requiere_admin)],
    summary="Obtener un pedido",
)
def obtener_pedido(pedido_id: int, db: DB):
    return obtener_o_404(db, Pedido, pedido_id, "El pedido")


@router.put(
    "/{pedido_id}",
    response_model=PedidoSalida,
    dependencies=[Depends(requiere_admin)],
    summary="Modificar estado y notas del pedido",
)
def actualizar_pedido(pedido_id: int, datos: PedidoActualizar, db: DB):
    pedido = obtener_o_404(db, Pedido, pedido_id, "El pedido")
    servicio.cambiar_estado(db, pedido, datos.estado)
    if "notas" in datos.model_fields_set:
        pedido.notas = datos.notas
    db.commit()
    db.refresh(pedido)
    return pedido


@router.delete(
    "/{pedido_id}",
    status_code=204,
    dependencies=[Depends(requiere_admin)],
    summary="Eliminar pedido",
)
def eliminar_pedido(pedido_id: int, db: DB):
    pedido = obtener_o_404(db, Pedido, pedido_id, "El pedido")
    servicio.eliminar_pedido(db, pedido)
    return Response(status_code=204)
