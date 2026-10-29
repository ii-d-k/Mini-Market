// Mis pedidos: consulta los pedidos de un cliente por su email.
import { api, badgeEstado, cargando, emailGuardado, esc, fecha, montarNavbar, precio, vacio } from './comun.js';

montarNavbar('pedidos');

const formulario = document.getElementById('buscarPedidos');
const campoEmail = document.getElementById('email');
const resultado = document.getElementById('resultado');

async function buscar(email) {
  resultado.innerHTML = cargando('Buscando pedidos…');
  try {
    const pedidos = await api('/pedidos/buscar', { params: { email } });
    emailGuardado.guardar(email);
    if (!pedidos.length) {
      resultado.innerHTML = vacio('inbox', 'No hay pedidos con ese email', 'Revisa que esté bien escrito.');
      return;
    }
    resultado.innerHTML =
      `<p class="text-secondary small mb-3">${pedidos.length} pedido${pedidos.length === 1 ? '' : 's'} encontrados</p>` +
      pedidos.map(tarjetaPedido).join('');
  } catch (error) {
    resultado.innerHTML = vacio('exclamation-triangle', 'No se pudo consultar', error.message);
  }
}

function tarjetaPedido(pedido) {
  const filas = pedido.detalles
    .map(
      (d) => `<tr>
        <td>${esc(d.nombre_producto)}</td>
        <td class="text-center">${d.cantidad}</td>
        <td class="text-end">${precio(d.precio_unitario)}</td>
        <td class="text-end fw-semibold">${precio(d.subtotal)}</td>
      </tr>`
    )
    .join('');
  return `
    <article class="tarjeta mb-3 overflow-hidden">
      <header class="d-flex flex-wrap justify-content-between align-items-center gap-2 p-3 border-bottom bg-light-subtle">
        <div>
          <div class="fw-bold">Pedido #${pedido.id}</div>
          <div class="small text-secondary"><i class="bi bi-calendar3 me-1"></i>${fecha(pedido.fecha)}</div>
        </div>
        ${badgeEstado(pedido.estado)}
      </header>
      <div class="table-responsive">
        <table class="table table-sm mb-0 align-middle">
          <thead class="small text-secondary">
            <tr><th class="ps-3">Producto</th><th class="text-center">Cant.</th><th class="text-end">Precio</th><th class="text-end pe-3">Subtotal</th></tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <footer class="d-flex justify-content-between align-items-center p-3 border-top">
        <span class="small text-secondary">${pedido.notas ? `<i class="bi bi-chat-left-text me-1"></i>${esc(pedido.notas)}` : ''}</span>
        <span class="fs-5 fw-bold">Total: ${precio(pedido.total)}</span>
      </footer>
    </article>`;
}

formulario.addEventListener('submit', (evento) => {
  evento.preventDefault();
  if (!formulario.checkValidity()) {
    formulario.reportValidity();
    return;
  }
  const email = campoEmail.value.trim().toLowerCase();
  history.replaceState(null, '', `?email=${encodeURIComponent(email)}`);
  buscar(email);
});

const inicial = new URLSearchParams(location.search).get('email') || emailGuardado.obtener();
if (inicial) {
  campoEmail.value = inicial;
  buscar(inicial);
} else {
  resultado.innerHTML = vacio('search', 'Consulta tus pedidos', 'Ingresa tu email para empezar.');
}
