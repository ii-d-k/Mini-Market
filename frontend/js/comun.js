// Funciones compartidas: llamadas a la API, carrito, formato y componentes comunes.

const BASE_API = '/api';
const CLAVE_CARRITO = 'minimarket_carrito';
const CLAVE_SESION = 'minimarket_sesion';
const CLAVE_EMAIL = 'minimarket_email';

export const IMAGEN_DEFECTO = '/img/productos/sin-imagen.svg';

// ---------- Almacenamiento local seguro ----------
function leer(clave, porDefecto) {
  try {
    const valor = localStorage.getItem(clave);
    return valor ? JSON.parse(valor) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function escribir(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* almacenamiento no disponible */
  }
}

function borrar(clave) {
  try {
    localStorage.removeItem(clave);
  } catch {
    /* almacenamiento no disponible */
  }
}

// ---------- Sesión del administrador ----------
export const sesion = {
  token() {
    const datos = leer(CLAVE_SESION, null);
    if (!datos || datos.expira_en * 1000 < Date.now()) return null;
    return datos.token;
  },
  guardar(datos) {
    escribir(CLAVE_SESION, datos);
  },
  cerrar() {
    borrar(CLAVE_SESION);
  },
};

export const emailGuardado = {
  obtener: () => leer(CLAVE_EMAIL, ''),
  guardar: (email) => escribir(CLAVE_EMAIL, email),
};

// ---------- Cliente de la API ----------
export class ErrorApi extends Error {
  constructor(mensaje, estado) {
    super(mensaje);
    this.estado = estado;
  }
}

export async function api(ruta, { metodo = 'GET', datos, admin = false, params } = {}) {
  let url = BASE_API + ruta;
  if (params) {
    const limpios = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (limpios.length) url += '?' + new URLSearchParams(limpios).toString();
  }

  const cabeceras = {};
  if (datos !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (admin) {
    const token = sesion.token();
    if (token) cabeceras.Authorization = `Bearer ${token}`;
  }

  let respuesta;
  try {
    respuesta = await fetch(url, {
      method: metodo,
      headers: cabeceras,
      body: datos !== undefined ? JSON.stringify(datos) : undefined,
    });
  } catch {
    throw new ErrorApi('No se pudo conectar con el servidor', 0);
  }

  if (respuesta.status === 204) return null;

  let cuerpo = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    /* respuesta sin JSON */
  }

  if (!respuesta.ok) {
    if (respuesta.status === 401 && admin) sesion.cerrar();
    const detalle = cuerpo?.detail;
    const mensaje = typeof detalle === 'string' ? detalle : `Error ${respuesta.status}`;
    throw new ErrorApi(mensaje, respuesta.status);
  }
  return cuerpo;
}

// ---------- Carrito (solo guarda ids y cantidades; precios vienen de la API) ----------
export const carrito = {
  items() {
    return leer(CLAVE_CARRITO, []);
  },
  guardar(items) {
    escribir(CLAVE_CARRITO, items);
    actualizarContador();
  },
  cantidadDe(id) {
    return this.items().find((i) => i.id === id)?.cantidad ?? 0;
  },
  agregar(id, cantidad, stock) {
    const items = this.items();
    const item = items.find((i) => i.id === id);
    const nueva = (item?.cantidad ?? 0) + cantidad;
    if (nueva > stock) return false;
    if (item) item.cantidad = nueva;
    else items.push({ id, cantidad });
    this.guardar(items);
    return true;
  },
  cambiar(id, cantidad) {
    const items = this.items().map((i) => (i.id === id ? { ...i, cantidad } : i));
    this.guardar(items.filter((i) => i.cantidad > 0));
  },
  quitar(id) {
    this.guardar(this.items().filter((i) => i.id !== id));
  },
  vaciar() {
    this.guardar([]);
  },
  unidades() {
    return this.items().reduce((suma, i) => suma + i.cantidad, 0);
  },
};

export function actualizarContador() {
  const total = carrito.unidades();
  document.querySelectorAll('[data-contador-carrito]').forEach((el) => {
    el.textContent = total;
    el.classList.toggle('d-none', total === 0);
  });
}

// ---------- Formato ----------
const formatoMoneda = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
  maximumFractionDigits: 0,
});

export const precio = (valor) => formatoMoneda.format(valor ?? 0);

export function fecha(texto) {
  // El servidor guarda en UTC sin zona horaria.
  const conZona = /([zZ]|[+-]\d\d:\d\d)$/.test(texto) ? texto : `${texto}Z`;
  return new Date(conZona).toLocaleString('es-CR', { dateStyle: 'medium', timeStyle: 'short' });
}

export function esc(texto) {
  return String(texto ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function imagen(url, alt, clase = '') {
  const src = esc(url || IMAGEN_DEFECTO);
  return `<img src="${src}" alt="${esc(alt)}" class="${clase}" loading="lazy"
    onerror="this.onerror=null;this.src='${IMAGEN_DEFECTO}'">`;
}

export const ESTADOS = {
  pendiente: { texto: 'Pendiente', color: 'warning', icono: 'hourglass-split' },
  enviado: { texto: 'Enviado', color: 'info', icono: 'truck' },
  entregado: { texto: 'Entregado', color: 'success', icono: 'check-circle' },
  cancelado: { texto: 'Cancelado', color: 'secondary', icono: 'x-circle' },
};

export function badgeEstado(estado) {
  const e = ESTADOS[estado] ?? { texto: estado, color: 'light', icono: 'circle' };
  return `<span class="badge rounded-pill text-bg-${e.color}"><i class="bi bi-${e.icono} me-1"></i>${e.texto}</span>`;
}

export function textoStock(producto) {
  if (producto.stock === 0) return '<span class="stock stock-agotado"><i class="bi bi-x-circle"></i> Agotado</span>';
  if (producto.bajo_stock) return `<span class="stock stock-bajo"><i class="bi bi-exclamation-circle"></i> ¡Solo quedan ${producto.stock}!</span>`;
  return `<span class="stock stock-ok"><i class="bi bi-check-circle"></i> ${producto.stock} disponibles</span>`;
}

// ---------- Avisos ----------
export function aviso(mensaje, tipo = 'success') {
  let contenedor = document.querySelector('.toast-container');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.append(contenedor);
  }
  const iconos = { success: 'check-circle-fill', danger: 'exclamation-triangle-fill', warning: 'exclamation-circle-fill', info: 'info-circle-fill' };
  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${tipo} border-0`;
  el.setAttribute('role', 'alert');
  el.innerHTML = `<div class="d-flex"><div class="toast-body"><i class="bi bi-${iconos[tipo] ?? 'info-circle-fill'} me-2"></i>${esc(mensaje)}</div>
    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button></div>`;
  contenedor.append(el);
  const toast = new bootstrap.Toast(el, { delay: 3500 });
  el.addEventListener('hidden.bs.toast', () => el.remove());
  toast.show();
}

export function cargando(texto = 'Cargando…') {
  return `<div class="vacio"><div class="spinner-border text-success mb-3" role="status"></div><div>${esc(texto)}</div></div>`;
}

export function vacio(icono, titulo, texto = '') {
  return `<div class="vacio"><i class="bi bi-${icono}"></i><h5 class="text-body">${esc(titulo)}</h5><p class="mb-0">${esc(texto)}</p></div>`;
}

// ---------- Navegación y pie ----------
export function montarNavbar(activa) {
  const enlace = (id, href, icono, texto) =>
    `<li class="nav-item"><a class="nav-link ${activa === id ? 'active' : ''}" href="${href}"
      ${activa === id ? 'aria-current="page"' : ''}><i class="bi bi-${icono} me-1"></i>${texto}</a></li>`;
  const botonCarrito = (clases) => `
    <a class="btn btn-primary position-relative ${clases}" href="/carrito.html" aria-label="Ver carrito">
      <i class="bi bi-cart3"></i><span class="d-none d-sm-inline ms-1">Carrito</span>
      <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-warning text-dark contador-carrito d-none" data-contador-carrito>0</span>
    </a>`;

  document.getElementById('navbar').innerHTML = `
    <nav class="navbar navbar-expand-lg border-bottom sticky-top">
      <div class="container">
        <a class="navbar-brand fw-bold d-flex align-items-center gap-2" href="/">
          <span class="marca-logo"><i class="bi bi-basket2-fill"></i></span> MiniMarket
        </a>
        <div class="d-flex align-items-center gap-2 order-lg-last">
          ${botonCarrito('')}
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#menu"
            aria-controls="menu" aria-expanded="false" aria-label="Abrir menú">
            <span class="navbar-toggler-icon"></span>
          </button>
        </div>
        <div class="collapse navbar-collapse" id="menu">
          <ul class="navbar-nav ms-auto me-lg-3">
            ${enlace('catalogo', '/', 'shop', 'Catálogo')}
            ${enlace('pedidos', '/pedidos.html', 'receipt', 'Mis pedidos')}
            ${enlace('admin', '/admin.html', 'speedometer2', 'Administración')}
          </ul>
        </div>
      </div>
    </nav>`;

  const pie = document.getElementById('pie');
  if (pie) {
    pie.innerHTML = `
      <footer class="border-top bg-white mt-5 py-4">
        <div class="container d-flex flex-column flex-md-row justify-content-between gap-2">
          <span><i class="bi bi-basket2-fill text-success me-1"></i><strong>MiniMarket</strong> · Tienda en línea</span>
          <span>Proyecto web con Python, FastAPI y SQLite · <a href="/docs" target="_blank" rel="noopener">Documentación de la API</a></span>
        </div>
      </footer>`;
  }
  actualizarContador();
}
