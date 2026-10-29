-- Estructura de la base de datos de MiniMarket (SQLite)
-- Generada a partir de los modelos en app/models.py.
-- Para crear la base con datos de ejemplo use: python database/seed.py

PRAGMA foreign_keys = ON;

-- Tabla: categorias
CREATE TABLE categorias (
	id INTEGER NOT NULL, 
	nombre VARCHAR(80) NOT NULL, 
	descripcion TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (nombre)
);

-- Tabla: productos
CREATE TABLE productos (
	id INTEGER NOT NULL, 
	nombre VARCHAR(120) NOT NULL, 
	descripcion TEXT, 
	precio FLOAT NOT NULL, 
	stock INTEGER NOT NULL, 
	stock_minimo INTEGER NOT NULL, 
	imagen_url VARCHAR(500), 
	activo BOOLEAN NOT NULL, 
	categoria_id INTEGER NOT NULL, 
	creado_en DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_producto_precio CHECK (precio >= 0), 
	CONSTRAINT ck_producto_stock CHECK (stock >= 0), 
	FOREIGN KEY(categoria_id) REFERENCES categorias (id) ON DELETE RESTRICT
);

-- Tabla: clientes
CREATE TABLE clientes (
	id INTEGER NOT NULL, 
	nombre VARCHAR(120) NOT NULL, 
	email VARCHAR(120) NOT NULL, 
	telefono VARCHAR(30), 
	direccion VARCHAR(250), 
	creado_en DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (email)
);

-- Tabla: pedidos
CREATE TABLE pedidos (
	id INTEGER NOT NULL, 
	cliente_id INTEGER NOT NULL, 
	fecha DATETIME NOT NULL, 
	estado VARCHAR(20) NOT NULL, 
	total FLOAT NOT NULL, 
	notas TEXT, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_pedido_estado CHECK (estado IN ('pendiente', 'enviado', 'entregado', 'cancelado')), 
	FOREIGN KEY(cliente_id) REFERENCES clientes (id) ON DELETE RESTRICT
);

-- Tabla: detalle_pedido
CREATE TABLE detalle_pedido (
	id INTEGER NOT NULL, 
	pedido_id INTEGER NOT NULL, 
	producto_id INTEGER, 
	nombre_producto VARCHAR(120) NOT NULL, 
	cantidad INTEGER NOT NULL, 
	precio_unitario FLOAT NOT NULL, 
	subtotal FLOAT NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_detalle_cantidad CHECK (cantidad > 0), 
	FOREIGN KEY(pedido_id) REFERENCES pedidos (id) ON DELETE CASCADE, 
	FOREIGN KEY(producto_id) REFERENCES productos (id) ON DELETE SET NULL
);

