"""
Ponto de entrada raiz para execução do servidor Uvicorn.
Importa a aplicação configurada com Clean Architecture em app.main.
"""
from app.main import app

__all__ = ["app"]
