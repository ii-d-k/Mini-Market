"""Pruebas de la API con una base de datos temporal.

Uso:  pip install pytest httpx   y luego   pytest
"""
import os
import tempfile
from pathlib import Path

os.environ["MINIMARKET_DB"] = str(Path(tempfile.mkdtemp()) / "prueba.db")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

cliente = TestClient(app)


@pytest.fixture(scope="module")
def admin():
    resp = cliente.post("/api/admin/login", json={"password": "admin123"})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['token']}"}


def test_frontend_y_salud():
    assert cliente.get("/").status_code == 200
    assert cliente.get("/api/salud").json() == {"estado": "ok"}


def test_listar_productos_y_filtrar():
    productos = cliente.get("/api/productos").json()
    assert len(productos) > 0
    assert "categoria" in productos[0] and "bajo_stock" in productos[0]
    filtrados = cliente.get("/api/productos", params={"buscar": "café"}).json()
    assert all("Café" in p["nombre"] for p in filtrados)


def test_rutas_admin_protegidas():
    assert cliente.post("/api/categorias", json={"nombre": "X1"}).status_code == 401
    assert cliente.get("/api/clientes").status_code == 401
    assert cliente.post("/api/admin/login", json={"password": "mala"}).status_code == 401


def test_crud_categoria_y_producto(admin):
    cat = cliente.post("/api/categorias", json={"nombre": "Panadería"}, headers=admin)
    assert cat.status_code == 201
    cat_id = cat.json()["id"]
    assert cliente.post("/api/categorias", json={"nombre": "panadería"}, headers=admin).status_code == 409

    nuevo = {"nombre": "Pan baguette", "precio": 1000, "stock": 10, "categoria_id": cat_id}
    prod = cliente.post("/api/productos", json=nuevo, headers=admin)
    assert prod.status_code == 201
    prod_id = prod.json()["id"]

    nuevo["precio"] = 1200
    assert cliente.put(f"/api/productos/{prod_id}", json=nuevo, headers=admin).json()["precio"] == 1200
    assert cliente.patch(f"/api/productos/{prod_id}/stock", json={"cantidad": 5}, headers=admin).json()["stock"] == 15
    assert cliente.patch(f"/api/productos/{prod_id}/stock", json={"cantidad": -50}, headers=admin).status_code == 400

    # No se puede borrar una categoría con productos.
    assert cliente.delete(f"/api/categorias/{cat_id}", headers=admin).status_code == 400
    assert cliente.delete(f"/api/productos/{prod_id}", headers=admin).status_code == 204
    assert cliente.get(f"/api/productos/{prod_id}").status_code == 404
    assert cliente.delete(f"/api/categorias/{cat_id}", headers=admin).status_code == 204


def test_pedido_descuenta_stock_y_cancelar_lo_devuelve(admin):
    producto = cliente.get("/api/productos").json()[0]
    pid, stock = producto["id"], producto["stock"]
    datos = {
        "cliente": {"nombre": "Prueba", "email": "Prueba@Example.com"},
        "items": [{"producto_id": pid, "cantidad": 2}],
    }
    pedido = cliente.post("/api/pedidos", json=datos)
    assert pedido.status_code == 201
    pedido = pedido.json()
    assert pedido["total"] == producto["precio"] * 2
    assert pedido["cliente"]["email"] == "prueba@example.com"
    assert cliente.get(f"/api/productos/{pid}").json()["stock"] == stock - 2

    encontrados = cliente.get("/api/pedidos/buscar", params={"email": "prueba@example.com"}).json()
    assert pedido["id"] in [p["id"] for p in encontrados]

    url = f"/api/pedidos/{pedido['id']}"
    assert cliente.put(url, json={"estado": "entregado"}, headers=admin).status_code == 400
    assert cliente.put(url, json={"estado": "cancelado"}, headers=admin).json()["estado"] == "cancelado"
    assert cliente.get(f"/api/productos/{pid}").json()["stock"] == stock
    assert cliente.delete(url, headers=admin).status_code == 204


def test_pedido_sin_stock():
    producto = cliente.get("/api/productos").json()[0]
    datos = {
        "cliente": {"nombre": "Prueba", "email": "prueba@example.com"},
        "items": [{"producto_id": producto["id"], "cantidad": producto["stock"] + 1}],
    }
    resp = cliente.post("/api/pedidos", json=datos)
    assert resp.status_code in (400, 422)


def test_crud_clientes_y_resumen(admin):
    nuevo = {"nombre": "Mario Solís", "email": "mario@example.com"}
    creado = cliente.post("/api/clientes", json=nuevo, headers=admin)
    assert creado.status_code == 201
    cid = creado.json()["id"]
    nuevo["telefono"] = "8000-0000"
    assert cliente.put(f"/api/clientes/{cid}", json=nuevo, headers=admin).json()["telefono"] == "8000-0000"
    assert cliente.delete(f"/api/clientes/{cid}", headers=admin).status_code == 204

    resumen = cliente.get("/api/admin/resumen", headers=admin).json()
    assert resumen["total_productos"] > 0
    inventario = cliente.get("/api/admin/inventario", headers=admin).json()
    assert inventario["valor_inventario"] > 0


def test_validacion_datos():
    resp = cliente.post("/api/pedidos", json={"cliente": {"nombre": "A", "email": "no-es-email"}, "items": []})
    assert resp.status_code == 422
    assert resp.json()["detail"].startswith("Datos inválidos")
