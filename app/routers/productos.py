"""Rutas CRUD de productos y ajuste de inventario."""
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from ..auth import requiere_admin
from ..database import DB
from ..errores import ErrorNegocio, obtener_o_404
from ..models import Categoria, Producto
from ..schemas import AjusteStock, ProductoEntrada, ProductoSalida

router = APIRouter(prefix="/api/productos", tags=["Productos"])


def _validar_categoria(db, categoria_id: int) -> None:
    if db.get(Categoria, categoria_id) is None:
        raise ErrorNegocio(f"La categoría con id {categoria_id} no existe")


@router.get("", response_model=list[ProductoSalida], summary="Listar productos")
def listar_productos(
    db: DB,
    categoria_id: int | None = Query(default=None, description="Filtrar por categoría"),
    buscar: str | None = Query(default=None, description="Texto a buscar en nombre o descripción"),
    solo_activos: bool = Query(default=True, description="Ocultar productos inactivos"),
):
    consulta = select(Producto).options(selectinload(Producto.categoria)).order_by(Producto.nombre)
    if categoria_id is not None:
        consulta = consulta.where(Producto.categoria_id == categoria_id)
    if buscar:
        patron = f"%{buscar.strip()}%"
        consulta = consulta.where(
            or_(Producto.nombre.ilike(patron), Producto.descripcion.ilike(patron))
        )
    if solo_activos:
        consulta = consulta.where(Producto.activo.is_(True))
    return db.scalars(consulta).all()


@router.get("/{producto_id}", response_model=ProductoSalida, summary="Obtener un producto")
def obtener_producto(producto_id: int, db: DB):
    return obtener_o_404(db, Producto, producto_id, "El producto")


@router.post(
    "",
    response_model=ProductoSalida,
    status_code=201,
    dependencies=[Depends(requiere_admin)],
    summary="Crear producto",
)
def crear_producto(datos: ProductoEntrada, db: DB):
    _validar_categoria(db, datos.categoria_id)
    producto = Producto(**datos.model_dump())
    db.add(producto)
    db.commit()
    db.refresh(producto)
    return producto


@router.put(
    "/{producto_id}",
    response_model=ProductoSalida,
    dependencies=[Depends(requiere_admin)],
    summary="Modificar producto",
)
def actualizar_producto(producto_id: int, datos: ProductoEntrada, db: DB):
    producto = obtener_o_404(db, Producto, producto_id, "El producto")
    _validar_categoria(db, datos.categoria_id)
    for campo, valor in datos.model_dump().items():
        setattr(producto, campo, valor)
    db.commit()
    db.refresh(producto)
    return producto


@router.patch(
    "/{producto_id}/stock",
    response_model=ProductoSalida,
    dependencies=[Depends(requiere_admin)],
    summary="Ajustar inventario (sumar o restar unidades)",
)
def ajustar_stock(producto_id: int, datos: AjusteStock, db: DB):
    producto = obtener_o_404(db, Producto, producto_id, "El producto")
    nuevo_stock = producto.stock + datos.cantidad
    if nuevo_stock < 0:
        raise ErrorNegocio(
            f"No se pueden restar {abs(datos.cantidad)} unidades: solo hay {producto.stock}"
        )
    producto.stock = nuevo_stock
    db.commit()
    db.refresh(producto)
    return producto


@router.delete(
    "/{producto_id}",
    status_code=204,
    dependencies=[Depends(requiere_admin)],
    summary="Eliminar producto",
)
def eliminar_producto(producto_id: int, db: DB):
    producto = obtener_o_404(db, Producto, producto_id, "El producto")
    # Los pedidos anteriores conservan el nombre y precio del producto.
    db.delete(producto)
    db.commit()
    return Response(status_code=204)
