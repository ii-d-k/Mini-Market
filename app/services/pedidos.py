"""Lógica de negocio de pedidos: stock, totales y cambios de estado."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..errores import ErrorNegocio
from ..models import Cliente, DetallePedido, Pedido, Producto
from ..schemas import PedidoEntrada

# Estados a los que puede pasar un pedido desde su estado actual.
TRANSICIONES = {
    "pendiente": {"enviado", "cancelado"},
    "enviado": {"entregado", "cancelado"},
    "entregado": set(),
    "cancelado": set(),
}


def crear_pedido(db: Session, datos: PedidoEntrada) -> Pedido:
    """Registra un pedido, valida el stock, descuenta inventario y calcula el total."""
    # Une productos repetidos en una sola línea.
    cantidades: dict[int, int] = {}
    for item in datos.items:
        cantidades[item.producto_id] = cantidades.get(item.producto_id, 0) + item.cantidad

    productos = {
        p.id: p for p in db.scalars(select(Producto).where(Producto.id.in_(cantidades)))
    }

    faltantes = []
    for producto_id, cantidad in cantidades.items():
        producto = productos.get(producto_id)
        if producto is None or not producto.activo:
            raise ErrorNegocio(f"El producto {producto_id} no existe o no está disponible", 404)
        if producto.stock < cantidad:
            faltantes.append(f"{producto.nombre} (disponibles: {producto.stock})")
    if faltantes:
        raise ErrorNegocio("Stock insuficiente: " + ", ".join(faltantes))

    # Busca al cliente por email; si no existe lo registra, si existe actualiza sus datos.
    datos_cliente = datos.cliente.model_dump()
    cliente = db.scalar(select(Cliente).where(Cliente.email == datos_cliente["email"]))
    if cliente is None:
        cliente = Cliente(**datos_cliente)
        db.add(cliente)
    else:
        for campo, valor in datos_cliente.items():
            if valor:
                setattr(cliente, campo, valor)

    pedido = Pedido(cliente=cliente, notas=datos.notas, estado="pendiente")
    total = 0.0
    for producto_id, cantidad in cantidades.items():
        producto = productos[producto_id]
        subtotal = round(producto.precio * cantidad, 2)
        pedido.detalles.append(
            DetallePedido(
                producto_id=producto.id,
                nombre_producto=producto.nombre,
                cantidad=cantidad,
                precio_unitario=producto.precio,
                subtotal=subtotal,
            )
        )
        producto.stock -= cantidad
        total += subtotal
    pedido.total = round(total, 2)

    db.add(pedido)
    db.commit()
    db.refresh(pedido)
    return pedido


def _devolver_stock(db: Session, pedido: Pedido) -> None:
    for detalle in pedido.detalles:
        if detalle.producto_id is not None:
            producto = db.get(Producto, detalle.producto_id)
            if producto is not None:
                producto.stock += detalle.cantidad


def cambiar_estado(db: Session, pedido: Pedido, nuevo_estado: str) -> None:
    """Cambia el estado respetando el flujo; al cancelar, el stock regresa."""
    if nuevo_estado == pedido.estado:
        return
    if nuevo_estado not in TRANSICIONES[pedido.estado]:
        raise ErrorNegocio(
            f"Un pedido '{pedido.estado}' no puede pasar a '{nuevo_estado}'"
        )
    if nuevo_estado == "cancelado":
        _devolver_stock(db, pedido)
    pedido.estado = nuevo_estado


def eliminar_pedido(db: Session, pedido: Pedido) -> None:
    """Elimina un pedido. Si seguía activo, sus productos vuelven al inventario."""
    if pedido.estado in ("pendiente", "enviado"):
        _devolver_stock(db, pedido)
    db.delete(pedido)
    db.commit()
