// Panel de administración: CRUD de productos, categorías, pedidos y clientes, e inventario.
import {
  api, aviso, badgeEstado, cargando, esc, ESTADOS, fecha, imagen, IMAGEN_DEFECTO,
  montarNavbar, precio, sesion, vacio,
} from './comun.js';

montarNavbar('admin');

const $ = (id) => document.getElementById(id);
const modal = (id) => bootstrap.Modal.getOrCreateInstance($(id));
const adminApi = (ruta, opciones = {}) => api(ruta, { ...opciones, admin: true });

// Registros cargados, por tipo e id, para abrir los formularios de edición.
const indice = { producto: new Map(), categoria: new Map(), pedido: new Map(), cliente: new Map() };
const registrar = (tipo, lista) => lista.forEach((r) => indice[tipo].set(r.id, r));

let categorias = [];
let productos = [];

const TRANSICIONES = {
  pendiente: ['enviado', 'cancelado'],
  enviado: ['entregado', 'cancelado'],
  entregado: [],
  cancelado: [],
};

const filaVacia = (columnas, icono, titulo, texto = '') =>
  `<tr><td colspan="${columnas}">${vacio(icono, titulo, texto)}</td></tr>`;
const filaCargando = (columnas) => `<tr><td colspan="${columnas}">${cargando()}</td></tr>`;

function botonesAccion(tipo, id, extra = '') {
  return `<td class="text-end acciones">
    ${extra}
    <button class="btn btn-sm btn-outline-secondary" data-accion="editar" data-tipo="${tipo}" data-id="${id}" title="Editar" aria-label="Editar"><i class="bi bi-pencil"></i></button>
    <button class="btn btn-sm btn-outline-danger" data-accion="eliminar" data-tipo="${tipo}" data-id="${id}" title="Eliminar" aria-label="Eliminar"><i class="bi bi-trash"></i></button>
  </td>`;
}

// ---------- Sesión ----------
function seccionActiva() {
  return document.querySelector('[data-seccion].active')?.dataset.seccion ?? 'resumen';
}

function mostrarVista() {
  const conectado = Boolean(sesion.token());
  $('vistaLogin').hidden = conectado;
  $('vistaPanel').hidden = !conectado;
  if (conectado) cargarSeccion(seccionActiva());
  else $('password').focus();
}

function manejarError(error) {
  if (error.estado === 401) {
    aviso('Tu sesión expiró. Vuelve a ingresar.', 'warning');
    document.querySelectorAll('.modal.show').forEach((m) => bootstrap.Modal.getInstance(m)?.hide());
    mostrarVista();
    return;
  }
  aviso(error.message, 'danger');
}

$('formLogin').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  try {
    const datos = await api('/admin/login', { metodo: 'POST', datos: { password: $('password').value } });
    sesion.guardar(datos);
    $('password').value = '';
    aviso('Sesión iniciada');
    mostrarVista();
  } catch (error) {
    aviso(error.message, 'danger');
  }
});

$('cerrarSesion').addEventListener('click', () => {
  sesion.cerrar();
  mostrarVista();
});

document.querySelectorAll('[data-seccion]').forEach((boton) =>
  boton.addEventListener('shown.bs.tab', () => cargarSeccion(boton.dataset.seccion))
);

async function cargarSeccion(seccion) {
  const cargadores = {
    resumen: cargarResumen,
    productos: cargarProductos,
    categorias: cargarCategorias,
    pedidos: cargarPedidos,
    clientes: cargarClientes,
  };
  try {
    await cargadores[seccion]();
  } catch (error) {
    manejarError(error);
  }
}

const recargar = () => cargarSeccion(seccionActiva());

// Ejecuta una operación, cierra el modal, avisa y recarga la sección.
async function ejecutar(operacion, mensaje, idModal = null) {
  try {
    await operacion();
    if (idModal) modal(idModal).hide();
    aviso(mensaje);
    await recargar();
  } catch (error) {
    manejarError(error);
  }
}

// ---------- Resumen ----------
function tarjetaDato(icono, color, valor, etiqueta) {
  return `<div class="col-6 col-lg-3"><div class="tarjeta estadistica">
    <div class="icono bg-${color}-subtle text-${color}-emphasis"><i class="bi bi-${icono}"></i></div>
    <div><div class="valor">${valor}</div><div class="etiqueta">${etiqueta}</div></div>
  </div></div>`;
}

async function cargarResumen() {
  $('resumen').innerHTML = cargando();
  const r = await adminApi('/admin/resumen');
  registrar('producto', r.bajo_stock);

  const estados = Object.entries(r.pedidos_por_estado)
    .map(([estado, n]) => `<li class="list-group-item d-flex justify-content-between align-items-center">${badgeEstado(estado)}<span class="fw-bold">${n}</span></li>`)
    .join('');

  const bajoStock = r.bajo_stock.length
    ? r.bajo_stock
        .map(
          (p) => `<tr>
          <td style="width:64px">${imagen(p.imagen_url, p.nombre)}</td>
          <td><div class="fw-semibold">${esc(p.nombre)}</div><div class="small text-secondary">Mínimo: ${p.stock_minimo}</div></td>
          <td class="text-center"><span class="badge text-bg-${p.stock === 0 ? 'danger' : 'warning'}">${p.stock === 0 ? 'Agotado' : `${p.stock} u.`}</span></td>
          <td class="text-end"><button class="btn btn-sm btn-outline-primary" data-accion="stock" data-tipo="producto" data-id="${p.id}"><i class="bi bi-plus-lg me-1"></i>Reponer</button></td>
        </tr>`
        )
        .join('')
    : filaVacia(4, 'check2-circle', 'Inventario en orden', 'Ningún producto está por debajo de su mínimo.');

  const ultimos = r.ultimos_pedidos.length
    ? r.ultimos_pedidos
        .map((p) => `<tr><td class="fw-semibold">#${p.id}</td><td>${esc(p.cliente.nombre)}</td><td class="text-end">${precio(p.total)}</td><td class="text-end">${badgeEstado(p.estado)}</td></tr>`)
        .join('')
    : filaVacia(4, 'inbox', 'Sin pedidos');

  $('resumen').innerHTML = `
    <div class="row g-3 mb-4">
      ${tarjetaDato('cash-stack', 'success', precio(r.ventas_totales), 'Ventas (sin cancelados)')}
      ${tarjetaDato('receipt', 'info', r.total_pedidos, 'Pedidos')}
      ${tarjetaDato('box-seam', 'warning', r.total_productos, 'Productos')}
      ${tarjetaDato('people', 'secondary', r.total_clientes, 'Clientes')}
    </div>
    <div class="row g-4">
      <div class="col-lg-7">
        <div class="tarjeta h-100">
          <div class="p-3 border-bottom fw-bold"><i class="bi bi-exclamation-triangle text-warning me-1"></i>Productos con bajo stock</div>
          <div class="table-responsive"><table class="table tabla-admin"><tbody>${bajoStock}</tbody></table></div>
        </div>
      </div>
      <div class="col-lg-5">
        <div class="tarjeta mb-4">
          <div class="p-3 border-bottom fw-bold">Pedidos por estado</div>
          <ul class="list-group list-group-flush rounded-bottom">${estados}</ul>
        </div>
        <div class="tarjeta">
          <div class="p-3 border-bottom fw-bold">Últimos pedidos</div>
          <div class="table-responsive"><table class="table tabla-admin"><tbody>${ultimos}</tbody></table></div>
        </div>
      </div>
    </div>`;
}

// ---------- Productos e inventario ----------
async function cargarProductos() {
  $('tablaProductos').innerHTML = filaCargando(7);
  const [inventario, cats] = await Promise.all([adminApi('/admin/inventario'), api('/categorias')]);
  productos = inventario.productos;
  categorias = cats;
  registrar('producto', productos);

  const seleccion = $('filtroCategoria').value;
  $('filtroCategoria').innerHTML =
    '<option value="">Todas las categorías</option>' +
    categorias.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  $('filtroCategoria').value = seleccion;

  $('totalesInventario').innerHTML = `
    ${tarjetaDato('box-seam', 'success', productos.length, 'Productos registrados')}
    ${tarjetaDato('stack', 'info', inventario.total_unidades, 'Unidades en bodega')}
    ${tarjetaDato('currency-exchange', 'secondary', precio(inventario.valor_inventario), 'Valor del inventario')}
    ${tarjetaDato('exclamation-triangle', 'warning', inventario.productos_bajo_stock, 'Con bajo stock')}`;
  pintarProductos();
}

function pintarProductos() {
  const texto = $('filtroProducto').value.trim().toLowerCase();
  const categoria = Number($('filtroCategoria').value) || null;
  const soloBajo = $('filtroBajoStock').checked;

  const lista = productos
    .filter((p) => !texto || p.nombre.toLowerCase().includes(texto))
    .filter((p) => !categoria || p.categoria.id === categoria)
    .filter((p) => !soloBajo || p.bajo_stock)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  if (!lista.length) {
    $('tablaProductos').innerHTML = filaVacia(7, 'box', 'No hay productos que coincidan');
    return;
  }

  $('tablaProductos').innerHTML = lista
    .map((p) => {
      const colorStock = p.stock === 0 ? 'danger' : p.bajo_stock ? 'warning' : 'success';
      return `<tr>
        <td style="width:64px">${imagen(p.imagen_url, p.nombre)}</td>
        <td><div class="fw-semibold">${esc(p.nombre)}</div><div class="small text-secondary text-truncate" style="max-width:260px">${esc(p.descripcion ?? '')}</div></td>
        <td>${esc(p.categoria.nombre)}</td>
        <td class="text-end">${precio(p.precio)}</td>
        <td class="text-center"><span class="badge text-bg-${colorStock}">${p.stock}</span><div class="small text-secondary">mín. ${p.stock_minimo}</div></td>
        <td>${p.activo ? '<span class="badge bg-success-subtle text-success-emphasis">Activo</span>' : '<span class="badge bg-secondary-subtle text-secondary-emphasis">Oculto</span>'}</td>
        ${botonesAccion('producto', p.id, `<button class="btn btn-sm btn-outline-primary" data-accion="stock" data-tipo="producto" data-id="${p.id}" title="Ajustar stock" aria-label="Ajustar stock"><i class="bi bi-box-arrow-in-down"></i></button>`)}
      </tr>`;
    })
    .join('');
}

['filtroProducto', 'filtroCategoria', 'filtroBajoStock'].forEach((id) =>
  $(id).addEventListener(id === 'filtroProducto' ? 'input' : 'change', pintarProductos)
);

function vistaPrevia() {
  $('pVistaPrevia').src = $('pImagen').value.trim() || IMAGEN_DEFECTO;
}
$('pImagen').addEventListener('input', vistaPrevia);
$('pVistaPrevia').addEventListener('error', () => {
  if (!$('pVistaPrevia').src.endsWith(IMAGEN_DEFECTO)) $('pVistaPrevia').src = IMAGEN_DEFECTO;
});

async function abrirProducto(id = null) {
  if (!categorias.length) categorias = await api('/categorias');
  if (!categorias.length) {
    aviso('Primero crea una categoría', 'warning');
    return;
  }
  const p = id ? indice.producto.get(id) : null;
  const f = $('formProducto');
  f.reset();
  f.classList.remove('was-validated');
  f.dataset.id = id ?? '';
  $('tituloProducto').textContent = p ? 'Editar producto' : 'Nuevo producto';
  $('pCategoria').innerHTML = categorias.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');

  const el = f.elements;
  el.nombre.value = p?.nombre ?? '';
  el.categoria_id.value = p?.categoria.id ?? categorias[0].id;
  el.precio.value = p?.precio ?? '';
  el.stock.value = p?.stock ?? 0;
  el.stock_minimo.value = p?.stock_minimo ?? 5;
  el.descripcion.value = p?.descripcion ?? '';
  el.imagen_url.value = p?.imagen_url ?? '';
  el.activo.checked = p?.activo ?? true;
  vistaPrevia();
  modal('modalProducto').show();
}

$('formProducto').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const f = evento.target;
  f.classList.add('was-validated');
  if (!f.checkValidity()) return;
  const el = f.elements;
  const datos = {
    nombre: el.nombre.value.trim(),
    categoria_id: Number(el.categoria_id.value),
    precio: Number(el.precio.value),
    stock: Number(el.stock.value),
    stock_minimo: Number(el.stock_minimo.value),
    descripcion: el.descripcion.value.trim() || null,
    imagen_url: el.imagen_url.value.trim() || null,
    activo: el.activo.checked,
  };
  const id = f.dataset.id;
  ejecutar(
    () => adminApi(id ? `/productos/${id}` : '/productos', { metodo: id ? 'PUT' : 'POST', datos }),
    id ? 'Producto actualizado' : 'Producto creado',
    'modalProducto'
  );
});

function abrirStock(id) {
  const p = indice.producto.get(id);
  const f = $('formStock');
  f.reset();
  f.dataset.id = id;
  $('stockNombre').textContent = p.nombre;
  $('stockActual').textContent = p.stock;
  modal('modalStock').show();
}

$('formStock').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const f = evento.target;
  if (!f.checkValidity()) {
    f.reportValidity();
    return;
  }
  const cantidad = Number(f.elements.cantidad.value) * (f.elements.tipo.value === 'salida' ? -1 : 1);
  ejecutar(
    () => adminApi(`/productos/${f.dataset.id}/stock`, { metodo: 'PATCH', datos: { cantidad } }),
    cantidad > 0 ? `Se agregaron ${cantidad} unidades` : `Se retiraron ${-cantidad} unidades`,
    'modalStock'
  );
});

// ---------- Categorías ----------
async function cargarCategorias() {
  $('tablaCategorias').innerHTML = filaCargando(4);
  const [cats, prods] = await Promise.all([api('/categorias'), api('/productos', { params: { solo_activos: false } })]);
  categorias = cats;
  registrar('categoria', cats);
  const conteo = {};
  prods.forEach((p) => (conteo[p.categoria.id] = (conteo[p.categoria.id] ?? 0) + 1));

  $('tablaCategorias').innerHTML = cats.length
    ? cats
        .map(
          (c) => `<tr>
          <td class="fw-semibold">${esc(c.nombre)}</td>
          <td class="text-secondary">${esc(c.descripcion ?? '')}</td>
          <td class="text-center"><span class="badge bg-success-subtle text-success-emphasis">${conteo[c.id] ?? 0}</span></td>
          ${botonesAccion('categoria', c.id)}
        </tr>`
        )
        .join('')
    : filaVacia(4, 'tags', 'No hay categorías');
}

function abrirCategoria(id = null) {
  const c = id ? indice.categoria.get(id) : null;
  const f = $('formCategoria');
  f.reset();
  f.classList.remove('was-validated');
  f.dataset.id = id ?? '';
  $('tituloCategoria').textContent = c ? 'Editar categoría' : 'Nueva categoría';
  f.elements.nombre.value = c?.nombre ?? '';
  f.elements.descripcion.value = c?.descripcion ?? '';
  modal('modalCategoria').show();
}

$('formCategoria').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const f = evento.target;
  f.classList.add('was-validated');
  if (!f.checkValidity()) return;
  const datos = {
    nombre: f.elements.nombre.value.trim(),
    descripcion: f.elements.descripcion.value.trim() || null,
  };
  const id = f.dataset.id;
  ejecutar(
    () => adminApi(id ? `/categorias/${id}` : '/categorias', { metodo: id ? 'PUT' : 'POST', datos }),
    id ? 'Categoría actualizada' : 'Categoría creada',
    'modalCategoria'
  );
});

// ---------- Pedidos ----------
async function cargarPedidos() {
  $('tablaPedidos').innerHTML = filaCargando(7);
  const pedidos = await adminApi('/pedidos', { params: { estado: $('filtroEstado').value } });
  registrar('pedido', pedidos);

  $('tablaPedidos').innerHTML = pedidos.length
    ? pedidos
        .map((p) => {
          const articulos = p.detalles.reduce((s, d) => s + d.cantidad, 0);
          return `<tr>
          <td class="fw-semibold">#${p.id}</td>
          <td class="small">${fecha(p.fecha)}</td>
          <td><div>${esc(p.cliente.nombre)}</div><div class="small text-secondary">${esc(p.cliente.email)}</div></td>
          <td class="text-center">${articulos}</td>
          <td class="text-end fw-semibold">${precio(p.total)}</td>
          <td>${badgeEstado(p.estado)}</td>
          <td class="text-end acciones">
            <button class="btn btn-sm btn-outline-primary" data-accion="editar" data-tipo="pedido" data-id="${p.id}" title="Ver y cambiar estado" aria-label="Ver pedido"><i class="bi bi-eye"></i></button>
            <button class="btn btn-sm btn-outline-danger" data-accion="eliminar" data-tipo="pedido" data-id="${p.id}" title="Eliminar" aria-label="Eliminar"><i class="bi bi-trash"></i></button>
          </td>
        </tr>`;
        })
        .join('')
    : filaVacia(7, 'inbox', 'No hay pedidos', 'Cuando un cliente compre, aparecerá aquí.');
}

$('filtroEstado').addEventListener('change', () => cargarSeccion('pedidos'));

function abrirPedido(id) {
  const p = indice.pedido.get(id);
  const f = $('formPedido');
  f.dataset.id = id;
  $('tituloPedido').innerHTML = `Pedido #${p.id} ${badgeEstado(p.estado)}`;

  const filas = p.detalles
    .map((d) => `<tr><td>${esc(d.nombre_producto)}</td><td class="text-center">${d.cantidad}</td><td class="text-end">${precio(d.precio_unitario)}</td><td class="text-end fw-semibold">${precio(d.subtotal)}</td></tr>`)
    .join('');
  $('detallePedido').innerHTML = `
    <div class="row g-3 mb-3 small">
      <div class="col-sm-6"><div class="text-secondary">Cliente</div><div class="fw-semibold">${esc(p.cliente.nombre)}</div>
        <div>${esc(p.cliente.email)}</div><div>${esc(p.cliente.telefono ?? '')}</div></div>
      <div class="col-sm-6"><div class="text-secondary">Entrega</div><div>${esc(p.cliente.direccion ?? 'Sin dirección')}</div>
        <div class="text-secondary mt-2">Fecha</div><div>${fecha(p.fecha)}</div></div>
    </div>
    <div class="table-responsive border rounded-3">
      <table class="table table-sm mb-0">
        <thead class="small text-secondary"><tr><th class="ps-3">Producto</th><th class="text-center">Cant.</th><th class="text-end">Precio</th><th class="text-end pe-3">Subtotal</th></tr></thead>
        <tbody>${filas}</tbody>
        <tfoot><tr><td colspan="3" class="text-end fw-bold">Total</td><td class="text-end fw-bold">${precio(p.total)}</td></tr></tfoot>
      </table>
    </div>`;

  const opciones = [p.estado, ...TRANSICIONES[p.estado]];
  $('pedEstado').innerHTML = opciones.map((e) => `<option value="${e}">${ESTADOS[e].texto}</option>`).join('');
  $('pedEstado').disabled = opciones.length === 1;
  $('pedNotas').value = p.notas ?? '';
  modal('modalPedido').show();
}

$('formPedido').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const f = evento.target;
  const p = indice.pedido.get(Number(f.dataset.id));
  const datos = { estado: $('pedEstado').value, notas: $('pedNotas').value.trim() || null };
  if (datos.estado === 'cancelado' && !confirm(`¿Cancelar el pedido #${p.id}? Las unidades regresarán al inventario.`)) return;
  ejecutar(() => adminApi(`/pedidos/${p.id}`, { metodo: 'PUT', datos }), 'Pedido actualizado', 'modalPedido');
});

// ---------- Clientes ----------
let esperaCliente;
async function cargarClientes() {
  $('tablaClientes').innerHTML = filaCargando(5);
  const clientes = await adminApi('/clientes', { params: { buscar: $('filtroCliente').value.trim() } });
  registrar('cliente', clientes);
  $('tablaClientes').innerHTML = clientes.length
    ? clientes
        .map(
          (c) => `<tr>
          <td class="fw-semibold">${esc(c.nombre)}</td>
          <td>${esc(c.email)}</td>
          <td>${esc(c.telefono ?? '')}</td>
          <td class="text-secondary">${esc(c.direccion ?? '')}</td>
          ${botonesAccion('cliente', c.id)}
        </tr>`
        )
        .join('')
    : filaVacia(5, 'people', 'No hay clientes');
}

$('filtroCliente').addEventListener('input', () => {
  clearTimeout(esperaCliente);
  esperaCliente = setTimeout(() => cargarSeccion('clientes'), 300);
});

function abrirCliente(id = null) {
  const c = id ? indice.cliente.get(id) : null;
  const f = $('formCliente');
  f.reset();
  f.classList.remove('was-validated');
  f.dataset.id = id ?? '';
  $('tituloCliente').textContent = c ? 'Editar cliente' : 'Nuevo cliente';
  for (const campo of ['nombre', 'email', 'telefono', 'direccion']) f.elements[campo].value = c?.[campo] ?? '';
  modal('modalCliente').show();
}

$('formCliente').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const f = evento.target;
  f.classList.add('was-validated');
  if (!f.checkValidity()) return;
  const el = f.elements;
  const datos = {
    nombre: el.nombre.value.trim(),
    email: el.email.value.trim(),
    telefono: el.telefono.value.trim() || null,
    direccion: el.direccion.value.trim() || null,
  };
  const id = f.dataset.id;
  ejecutar(
    () => adminApi(id ? `/clientes/${id}` : '/clientes', { metodo: id ? 'PUT' : 'POST', datos }),
    id ? 'Cliente actualizado' : 'Cliente creado',
    'modalCliente'
  );
});

// ---------- Acciones de las tablas ----------
const ELIMINAR = {
  producto: (r) => [`/productos/${r.id}`, `¿Eliminar el producto "${r.nombre}"? Los pedidos anteriores conservarán su nombre.`, 'Producto eliminado'],
  categoria: (r) => [`/categorias/${r.id}`, `¿Eliminar la categoría "${r.nombre}"?`, 'Categoría eliminada'],
  pedido: (r) => [`/pedidos/${r.id}`, `¿Eliminar el pedido #${r.id}?${['pendiente', 'enviado'].includes(r.estado) ? ' Sus unidades regresarán al inventario.' : ''}`, 'Pedido eliminado'],
  cliente: (r) => [`/clientes/${r.id}`, `¿Eliminar al cliente "${r.nombre}"?`, 'Cliente eliminado'],
};

const EDITAR = { producto: abrirProducto, categoria: abrirCategoria, pedido: abrirPedido, cliente: abrirCliente };

$('vistaPanel').addEventListener('click', (evento) => {
  const boton = evento.target.closest('[data-accion], [data-nuevo]');
  if (!boton) return;
  if (boton.dataset.nuevo) {
    EDITAR[boton.dataset.nuevo]();
    return;
  }
  const { accion, tipo } = boton.dataset;
  const id = Number(boton.dataset.id);
  if (accion === 'editar') EDITAR[tipo](id);
  if (accion === 'stock') abrirStock(id);
  if (accion === 'eliminar') {
    const [ruta, pregunta, mensaje] = ELIMINAR[tipo](indice[tipo].get(id));
    if (confirm(pregunta)) ejecutar(() => adminApi(ruta, { metodo: 'DELETE' }), mensaje);
  }
});

mostrarVista();
