"""Crea las tablas y carga datos de ejemplo cuando la base está vacía."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine
from .models import Categoria, Producto
from .schemas import ClienteEntrada, ItemPedido, PedidoEntrada
from .services.pedidos import cambiar_estado, crear_pedido

CATEGORIAS = [
    ("Abarrotes", "Granos, aceites, café y productos básicos de despensa"),
    ("Bebidas", "Aguas, jugos y refrescos"),
    ("Lácteos y huevos", "Leche, quesos y huevos frescos"),
    ("Frutas y verduras", "Productos frescos de temporada"),
    ("Limpieza", "Artículos de limpieza para el hogar"),
    ("Snacks", "Galletas, chocolates y bocadillos"),
]

# (nombre, descripción, precio, stock, stock_mínimo, imagen, categoría)
PRODUCTOS = [
    ("Arroz blanco 1 kg", "Arroz grano entero 99%", 1350, 40, 10, "arroz", "Abarrotes"),
    ("Frijoles negros 900 g", "Frijoles negros seleccionados", 1250, 30, 8, "frijoles", "Abarrotes"),
    ("Aceite vegetal 1 L", "Aceite de soya para cocinar", 2400, 18, 5, "aceite", "Abarrotes"),
    ("Café molido 500 g", "Café 100% costarricense, tueste medio", 3200, 25, 6, "cafe", "Abarrotes"),
    ("Pasta spaghetti 500 g", "Pasta de trigo de cocción rápida", 850, 35, 10, "pasta", "Abarrotes"),
    ("Agua pura 600 ml", "Agua purificada sin gas", 600, 60, 15, "agua", "Bebidas"),
    ("Jugo de naranja 1 L", "Jugo natural sin azúcar añadida", 1500, 20, 6, "jugo", "Bebidas"),
    ("Refresco 2 L", "Bebida gaseosa sabor cola", 1800, 24, 6, "refresco", "Bebidas"),
    ("Leche entera 1 L", "Leche pasteurizada entera", 950, 36, 12, "leche", "Lácteos y huevos"),
    ("Queso blanco 500 g", "Queso fresco tipo Turrialba", 3500, 10, 4, "queso", "Lácteos y huevos"),
    ("Huevos (12 unidades)", "Huevos frescos de granja", 2600, 15, 5, "huevos", "Lácteos y huevos"),
    ("Banano (kg)", "Banano maduro nacional", 700, 50, 10, "banano", "Frutas y verduras"),
    ("Manzana roja (kg)", "Manzana roja importada", 1900, 22, 8, "manzana", "Frutas y verduras"),
    ("Tomate (kg)", "Tomate fresco para ensalada", 1200, 28, 8, "tomate", "Frutas y verduras"),
    ("Aguacate", "Aguacate Hass por unidad", 800, 3, 5, "aguacate", "Frutas y verduras"),
    ("Jabón líquido 1 L", "Jabón líquido multiusos", 1800, 14, 5, "jabon", "Limpieza"),
    ("Papel higiénico (4 rollos)", "Papel doble hoja", 2100, 4, 6, "papel", "Limpieza"),
    ("Esponjas (3 unidades)", "Esponjas para lavar platos", 650, 26, 6, "esponja", "Limpieza"),
    ("Galletas de chocolate", "Paquete de galletas rellenas", 900, 40, 10, "galletas", "Snacks"),
    ("Chocolate en barra", "Chocolate de leche 100 g", 1100, 30, 8, "chocolate", "Snacks"),
    ("Palomitas para microondas", "Palomitas sabor mantequilla", 750, 0, 5, "palomitas", "Snacks"),
]

CLIENTES = [
    ("Ana Rodríguez", "ana.rodriguez@example.com", "8888-1234", "San José, Barrio Escalante"),
    ("Carlos Mora", "carlos.mora@example.com", "8777-5678", "Heredia, San Pablo"),
    ("Lucía Jiménez", "lucia.jimenez@example.com", "8666-9012", "Cartago, Paraíso"),
]


def cargar_datos_iniciales(db: Session) -> None:
    categorias = {}
    for nombre, descripcion in CATEGORIAS:
        categoria = Categoria(nombre=nombre, descripcion=descripcion)
        db.add(categoria)
        categorias[nombre] = categoria

    productos = []
    for nombre, desc, precio, stock, minimo, imagen, categoria in PRODUCTOS:
        producto = Producto(
            nombre=nombre,
            descripcion=desc,
            precio=precio,
            stock=stock,
            stock_minimo=minimo,
            imagen_url=f"/img/productos/{imagen}.svg",
            categoria=categorias[categoria],
        )
        db.add(producto)
        productos.append(producto)
    db.commit()

    # Pedidos de ejemplo creados con la misma lógica que usa la tienda.
    def cliente(i: int) -> ClienteEntrada:
        nombre, email, telefono, direccion = CLIENTES[i]
        return ClienteEntrada(nombre=nombre, email=email, telefono=telefono, direccion=direccion)

    ejemplos = [
        (0, [(0, 2), (3, 1), (8, 3)], "entregado"),
        (1, [(5, 6), (18, 2)], "enviado"),
        (2, [(11, 2), (13, 1), (10, 1)], "pendiente"),
        (0, [(15, 1), (17, 2)], "cancelado"),
    ]
    for indice_cliente, items, estado in ejemplos:
        pedido = crear_pedido(
            db,
            PedidoEntrada(
                cliente=cliente(indice_cliente),
                items=[ItemPedido(producto_id=productos[i].id, cantidad=c) for i, c in items],
            ),
        )
        for paso in {"enviado": ["enviado"], "entregado": ["enviado", "entregado"],
                     "cancelado": ["cancelado"]}.get(estado, []):
            cambiar_estado(db, pedido, paso)
        db.commit()


def inicializar_base_datos() -> None:
    """Crea las tablas si no existen y carga datos si la base está vacía."""
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(Categoria)) == 0:
            cargar_datos_iniciales(db)
