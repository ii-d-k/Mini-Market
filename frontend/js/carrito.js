// Carrito: muestra los productos elegidos con precios actuales de la API y registra el pedido.
import { api, aviso, cargando, carrito, emailGuardado, esc, imagen, montarNavbar, precio, vacio } from './comun.js';

montarNavbar('carrito');

const lista = document.getElementById('items');
const formulario = document.getElementById('checkout');
const botonConfirmar = document.getElementById('confirmar');
let productos = new Map();

async function cargar() {
  lista.innerHTML = cargando('Cargando carrito…');
  if (!carrito.items().length) {
    pintar();
    return;
  }
  try {
    const datos = await api('/productos', { params: { solo_activos: false } });
    productos = new Map(datos.map((p) => [p.id, p]));
    // Quita del carrito productos que ya no existen o no están disponibles.
    const validos = carrito.items().filter((i) => productos.get(i.id)?.activo);
    if (validos.length !== carrito.items().length) {
      aviso('Algunos productos ya no están disponibles y se quitaron del carrito', 'warning');
      carrito.guardar(validos);
    }
    pintar();
  } catch (error) {
    lista.innerHTML = vacio('wifi-off', 'No se pudo cargar el carrito', error.message);
  }
}

function pintar() {
  const items = carrito.items();
  let total = 0;
  let unidades = 0;

  if (!items.length) {
    lista.innerHTML = `${vacio('cart-x', 'Tu carrito está vacío', 'Agrega productos desde el catálogo.')}
      <div class="text-center pb-4"><a href="/" class="btn btn-primary"><i class="bi bi-shop me-1"></i>Ir al catálogo</a></div>`;
  } else {
    lista.innerHTML = items
      .map((item, indice) => {
        const p = productos.get(item.id);
        const subtotal = p.precio * item.cantidad;
        const excede = item.cantidad > p.stock;
        total += subtotal;
        unidades += item.cantidad;
        return `
        <div class="item-carrito d-flex gap-3 align-items-center p-3 ${indice ? 'border-top' : ''}">
          ${imagen(p.imagen_url, p.nombre)}
          <div class="flex-grow-1 min-w-0">
            <div class="fw-semibold text-truncate">${esc(p.nombre)}</div>
            <div class="small text-secondary">${precio(p.precio)} c/u</div>
            ${excede ? `<div class="small text-danger"><i class="bi bi-exclamation-triangle"></i> Solo hay ${p.stock} disponibles</div>` : ''}
            <div class="d-flex align-items-center gap-2 mt-2">
              <div class="selector-cantidad">
                <button type="button" data-restar="${p.id}" aria-label="Quitar uno"><i class="bi bi-dash"></i></button>
                <span>${item.cantidad}</span>
                <button type="button" data-sumar="${p.id}" aria-label="Agregar uno" ${item.cantidad >= p.stock ? 'disabled' : ''}><i class="bi bi-plus"></i></button>
              </div>
              <button type="button" class="btn btn-link btn-sm text-danger text-decoration-none" data-quitar="${p.id}">
                <i class="bi bi-trash"></i> Quitar
              </button>
            </div>
          </div>
          <div class="fw-bold text-end">${precio(subtotal)}</div>
        </div>`;
      })
      .join('');
  }

  document.getElementById('unidades').textContent = unidades;
  document.getElementById('subtotal').textContent = precio(total);
  document.getElementById('total').textContent = precio(total);
  const hayExceso = items.some((i) => i.cantidad > (productos.get(i.id)?.stock ?? 0));
  botonConfirmar.disabled = !items.length || hayExceso;
}

lista.addEventListener('click', (evento) => {
  const boton = evento.target.closest('button');
  if (!boton) return;
  const { sumar, restar, quitar } = boton.dataset;
  if (sumar) carrito.cambiar(Number(sumar), carrito.cantidadDe(Number(sumar)) + 1);
  if (restar) carrito.cambiar(Number(restar), carrito.cantidadDe(Number(restar)) - 1);
  if (quitar) carrito.quitar(Number(quitar));
  pintar();
});

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  formulario.classList.add('was-validated');
  if (!formulario.checkValidity()) return;

  const datos = Object.fromEntries(new FormData(formulario));
  const pedido = {
    cliente: {
      nombre: datos.nombre,
      email: datos.email,
      telefono: datos.telefono,
      direccion: datos.direccion,
    },
    items: carrito.items().map((i) => ({ producto_id: i.id, cantidad: i.cantidad })),
    notas: datos.notas || null,
  };

  botonConfirmar.disabled = true;
  botonConfirmar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando…';
  try {
    const creado = await api('/pedidos', { metodo: 'POST', datos: pedido });
    emailGuardado.guardar(creado.cliente.email);
    carrito.vaciar();
    document.getElementById('numeroPedido').textContent = `#${creado.id}`;
    document.getElementById('totalPedido').textContent = precio(creado.total);
    document.getElementById('verPedidos').href = `/pedidos.html?email=${encodeURIComponent(creado.cliente.email)}`;
    bootstrap.Modal.getOrCreateInstance('#modalExito').show();
    formulario.reset();
    formulario.classList.remove('was-validated');
  } catch (error) {
    aviso(error.message, 'danger');
    await cargar(); // refresca stock por si cambió
  } finally {
    botonConfirmar.innerHTML = '<i class="bi bi-bag-check me-1"></i>Confirmar pedido';
    pintar();
  }
});

// Rellena el email si el cliente ya compró antes.
document.getElementById('email').value = emailGuardado.obtener();
cargar();
