"""Errores de negocio y utilidades para responder con mensajes claros."""
from sqlalchemy.orm import Session


class ErrorNegocio(Exception):
    """Error que se convierte en una respuesta JSON con el código indicado."""

    def __init__(self, mensaje: str, codigo: int = 400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.codigo = codigo


def obtener_o_404(db: Session, modelo, id_registro: int, nombre: str):
    """Busca un registro por id o lanza un error 404."""
    registro = db.get(modelo, id_registro)
    if registro is None:
        raise ErrorNegocio(f"{nombre} con id {id_registro} no existe", 404)
    return registro
