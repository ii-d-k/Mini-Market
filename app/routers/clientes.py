"""Rutas CRUD de clientes (solo administrador)."""
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, or_, select

from ..auth import requiere_admin
from ..database import DB
from ..errores import ErrorNegocio, obtener_o_404
from ..models import Cliente, Pedido
from ..schemas import ClienteEntrada, ClienteSalida

router = APIRouter(
    prefix="/api/clientes", tags=["Clientes"], dependencies=[Depends(requiere_admin)]
)


def _validar_email_unico(db, email: str, excluir_id: int | None = None) -> None:
    consulta = select(Cliente).where(Cliente.email == email)
    if excluir_id is not None:
        consulta = consulta.where(Cliente.id != excluir_id)
    if db.scalar(consulta) is not None:
        raise ErrorNegocio(f"Ya existe un cliente con el email {email}", 409)


@router.get("", response_model=list[ClienteSalida], summary="Listar clientes")
def listar_clientes(db: DB, buscar: str | None = Query(default=None)):
    consulta = select(Cliente).order_by(Cliente.nombre)
    if buscar:
        patron = f"%{buscar.strip()}%"
        consulta = consulta.where(or_(Cliente.nombre.ilike(patron), Cliente.email.ilike(patron)))
    return db.scalars(consulta).all()


@router.get("/{cliente_id}", response_model=ClienteSalida, summary="Obtener un cliente")
def obtener_cliente(cliente_id: int, db: DB):
    return obtener_o_404(db, Cliente, cliente_id, "El cliente")


@router.post("", response_model=ClienteSalida, status_code=201, summary="Crear cliente")
def crear_cliente(datos: ClienteEntrada, db: DB):
    _validar_email_unico(db, datos.email)
    cliente = Cliente(**datos.model_dump())
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


@router.put("/{cliente_id}", response_model=ClienteSalida, summary="Modificar cliente")
def actualizar_cliente(cliente_id: int, datos: ClienteEntrada, db: DB):
    cliente = obtener_o_404(db, Cliente, cliente_id, "El cliente")
    _validar_email_unico(db, datos.email, excluir_id=cliente_id)
    for campo, valor in datos.model_dump().items():
        setattr(cliente, campo, valor)
    db.commit()
    db.refresh(cliente)
    return cliente


@router.delete("/{cliente_id}", status_code=204, summary="Eliminar cliente")
def eliminar_cliente(cliente_id: int, db: DB):
    cliente = obtener_o_404(db, Cliente, cliente_id, "El cliente")
    cantidad = db.scalar(
        select(func.count()).select_from(Pedido).where(Pedido.cliente_id == cliente_id)
    )
    if cantidad:
        raise ErrorNegocio(
            f"No se puede eliminar: el cliente tiene {cantidad} pedido(s) registrados"
        )
    db.delete(cliente)
    db.commit()
    return Response(status_code=204)
