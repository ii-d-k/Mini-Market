"""Rutas CRUD de categorías."""
from fastapi import APIRouter, Depends, Response
from sqlalchemy import func, select

from ..auth import requiere_admin
from ..database import DB
from ..errores import ErrorNegocio, obtener_o_404
from ..models import Categoria, Producto
from ..schemas import CategoriaEntrada, CategoriaSalida

router = APIRouter(prefix="/api/categorias", tags=["Categorías"])


def _validar_nombre_unico(db, nombre: str, excluir_id: int | None = None) -> None:
    consulta = select(Categoria).where(func.lower(Categoria.nombre) == nombre.lower())
    if excluir_id is not None:
        consulta = consulta.where(Categoria.id != excluir_id)
    if db.scalar(consulta) is not None:
        raise ErrorNegocio(f"Ya existe una categoría llamada '{nombre}'", 409)


@router.get("", response_model=list[CategoriaSalida], summary="Listar categorías")
def listar_categorias(db: DB):
    return db.scalars(select(Categoria).order_by(Categoria.nombre)).all()


@router.get("/{categoria_id}", response_model=CategoriaSalida, summary="Obtener una categoría")
def obtener_categoria(categoria_id: int, db: DB):
    return obtener_o_404(db, Categoria, categoria_id, "La categoría")


@router.post(
    "",
    response_model=CategoriaSalida,
    status_code=201,
    dependencies=[Depends(requiere_admin)],
    summary="Crear categoría",
)
def crear_categoria(datos: CategoriaEntrada, db: DB):
    _validar_nombre_unico(db, datos.nombre)
    categoria = Categoria(**datos.model_dump())
    db.add(categoria)
    db.commit()
    db.refresh(categoria)
    return categoria


@router.put(
    "/{categoria_id}",
    response_model=CategoriaSalida,
    dependencies=[Depends(requiere_admin)],
    summary="Modificar categoría",
)
def actualizar_categoria(categoria_id: int, datos: CategoriaEntrada, db: DB):
    categoria = obtener_o_404(db, Categoria, categoria_id, "La categoría")
    _validar_nombre_unico(db, datos.nombre, excluir_id=categoria_id)
    for campo, valor in datos.model_dump().items():
        setattr(categoria, campo, valor)
    db.commit()
    db.refresh(categoria)
    return categoria


@router.delete(
    "/{categoria_id}",
    status_code=204,
    dependencies=[Depends(requiere_admin)],
    summary="Eliminar categoría",
)
def eliminar_categoria(categoria_id: int, db: DB):
    categoria = obtener_o_404(db, Categoria, categoria_id, "La categoría")
    cantidad = db.scalar(
        select(func.count()).select_from(Producto).where(Producto.categoria_id == categoria_id)
    )
    if cantidad:
        raise ErrorNegocio(
            f"No se puede eliminar: la categoría tiene {cantidad} producto(s). "
            "Muévalos a otra categoría primero."
        )
    db.delete(categoria)
    db.commit()
    return Response(status_code=204)
