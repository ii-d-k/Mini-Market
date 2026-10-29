"""Esquemas Pydantic: validan lo que entra y definen lo que sale de la API."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field, field_validator

EstadoPedido = Literal["pendiente", "enviado", "entregado", "cancelado"]


class Esquema(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)


# ---------- Categorías ----------
class CategoriaEntrada(Esquema):
    nombre: str = Field(min_length=2, max_length=80)
    descripcion: str | None = Field(default=None, max_length=500)


class CategoriaSalida(CategoriaEntrada):
    id: int


class CategoriaResumen(Esquema):
    id: int
    nombre: str


# ---------- Productos ----------
class ProductoEntrada(Esquema):
    nombre: str = Field(min_length=2, max_length=120)
    descripcion: str | None = Field(default=None, max_length=1000)
    precio: float = Field(ge=0)
    stock: int = Field(ge=0)
    stock_minimo: int = Field(default=5, ge=0)
    imagen_url: str | None = Field(default=None, max_length=500)
    activo: bool = True
    categoria_id: int


class ProductoSalida(ProductoEntrada):
    id: int
    categoria: CategoriaResumen

    @computed_field
    @property
    def bajo_stock(self) -> bool:
        return self.stock <= self.stock_minimo


class AjusteStock(Esquema):
    cantidad: int = Field(description="Unidades a sumar (positivo) o restar (negativo)")

    @field_validator("cantidad")
    @classmethod
    def no_cero(cls, valor: int) -> int:
        if valor == 0:
            raise ValueError("La cantidad no puede ser 0")
        return valor


# ---------- Clientes ----------
class ClienteEntrada(Esquema):
    nombre: str = Field(min_length=2, max_length=120)
    email: EmailStr
    telefono: str | None = Field(default=None, max_length=30)
    direccion: str | None = Field(default=None, max_length=250)

    @field_validator("email")
    @classmethod
    def email_minusculas(cls, valor: str) -> str:
        return valor.lower()


class ClienteSalida(ClienteEntrada):
    id: int
    creado_en: datetime


# ---------- Pedidos ----------
class ItemPedido(Esquema):
    producto_id: int
    cantidad: int = Field(gt=0, le=100)


class PedidoEntrada(Esquema):
    cliente: ClienteEntrada
    items: list[ItemPedido] = Field(min_length=1)
    notas: str | None = Field(default=None, max_length=500)


class PedidoActualizar(Esquema):
    estado: EstadoPedido
    notas: str | None = Field(default=None, max_length=500)


class DetalleSalida(Esquema):
    id: int
    producto_id: int | None
    nombre_producto: str
    cantidad: int
    precio_unitario: float
    subtotal: float


class PedidoSalida(Esquema):
    id: int
    fecha: datetime
    estado: EstadoPedido
    total: float
    notas: str | None
    cliente: ClienteSalida
    detalles: list[DetalleSalida]


# ---------- Administración ----------
class Login(Esquema):
    password: str = Field(min_length=1)


class Token(BaseModel):
    token: str
    expira_en: int


class Inventario(BaseModel):
    productos: list[ProductoSalida]
    total_unidades: int
    valor_inventario: float
    productos_bajo_stock: int


class Resumen(BaseModel):
    total_productos: int
    total_clientes: int
    total_pedidos: int
    ventas_totales: float
    pedidos_por_estado: dict[str, int]
    bajo_stock: list[ProductoSalida]
    ultimos_pedidos: list[PedidoSalida]
