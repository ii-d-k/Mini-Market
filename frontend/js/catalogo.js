// Catálogo: lista productos desde la API, filtra y agrega al carrito.
import { api, aviso, cargando, carrito, esc, imagen, montarNavbar, precio, textoStock, vacio } from './comun.js';

montarNavbar('catalogo');

const contenedor = document.getElementById('productos');
const filtros = document.getElementById('filtros');
const buscador = document.getElementById('buscar');
const conteo = document.getElementById('conteo');

let productos = [];
let categoriaActual = null;
let temporizador;

async function cargarCategorias() {
  try {
    const categorias = await api('/categorias');
    const chip = (id, nombre) =>
      `<button type="button" class="chip ${id === categoriaActual ? 'activo' : ''}" data-categoria="${id ?? ''}">${esc(nombre)}</button>`;
    filtros.innerHTML = chip(null, 'Todos') + categorias.map((c) => chip(c.id, c.nombre)).join('');
  } catch (error) {
    filtros.innerHTML = '';
    aviso(error.message, 'danger');
  }
}

async function cargarProductos() {
  contenedor.innerHTML = `<div class="col-12">${cargando('Cargando productos…')}</div>`;
  try {
    productos = await api('/productos', {
      params: { categoria_id: categoriaActual, buscar: buscador.value.trim() },
    });
    pintarProductos();
  } catch (error) {
    contenedor.innerHTML = `<div class="col-12">${vacio('wifi-off', 'No se pudieron cargar los productos', error.message)}</div>`;
  }
}

function pintarProductos() {
  conteo.textContent = `${productos.length} producto${productos.length === 1 ? '' : 's'}`;
  if (!productos.length) {
    contenedor.innerHTML = `<div class="col-12">${vacio('search', 'No encontramos productos', 'Prueba con otra búsqueda o categoría.')}</div>`;
    return;
  }
  contenedor.innerHTML = productos
    .map((p) => {
      const agotado = p.stock === 0;
      return `
      <div class="col">
        <article class="tarjeta producto ${agotado ? 'agotado' : ''}">
          ${imagen(p.imagen_url, p.nombre, 'producto-imagen')}
          <div class="producto-cuerpo">
            <span class="etiqueta-categoria">${esc(p.categoria.nombre)}</span>
            <h3 class="producto-nombre">${esc(p.nombre)}</h3>
            <p class="producto-descripcion">${esc(p.descripcion ?? '')}</p>
            <div class="mt-auto pt-2 d-flex justify-content-between align-items-end">
              <span class="producto-precio">${precio(p.precio)}</span>
              ${textoStock(p)}
            </div>
            <form class="d-flex gap-2 mt-2" data-agregar="${p.id}">
              <input type="number" class="form-control cantidad-input" name="cantidad" value="1" min="1"
                max="${Math.max(p.stock, 1)}" aria-label="Cantidad" ${agotado ? 'disabled' : ''}>
              <button type="submit" class="btn btn-primary flex-grow-1" ${agotado ? 'disabled' : ''}>
                <i class="bi bi-cart-plus me-1"></i>${agotado ? 'Agotado' : 'Agregar'}
              </button>
            </form>
          </div>
        </article>
      </div>`;
    })
    .join('');
}

filtros.addEventListener('click', (evento) => {
  const boton = evento.target.closest('[data-categoria]');
  if (!boton) return;
  categoriaActual = boton.dataset.categoria ? Number(boton.dataset.categoria) : null;
  filtros.querySelectorAll('.chip').forEach((c) => c.classList.toggle('activo', c === boton));
  cargarProductos();
});

buscador.addEventListener('input', () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(cargarProductos, 300);
});

contenedor.addEventListener('submit', (evento) => {
  evento.preventDefault();
  const formulario = evento.target.closest('[data-agregar]');
  const producto = productos.find((p) => p.id === Number(formulario.dataset.agregar));
  const cantidad = Number(formulario.cantidad.value);
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    aviso('Ingresa una cantidad válida', 'warning');
    return;
  }
  if (carrito.agregar(producto.id, cantidad, producto.stock)) {
    aviso(`${producto.nombre} agregado al carrito (${carrito.cantidadDe(producto.id)})`);
    formulario.cantidad.value = 1;
  } else {
    const enCarrito = carrito.cantidadDe(producto.id);
    aviso(`Solo hay ${producto.stock} disponibles y ya tienes ${enCarrito} en el carrito`, 'warning');
  }
});

cargarCategorias();
cargarProductos();
