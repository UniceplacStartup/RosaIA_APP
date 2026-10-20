from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from datetime import datetime, timezone
from sqlalchemy import DateTime


class Base(DeclarativeBase):
    """Base declarativa com convenções compartilhadas para todos os modelos ORM."""
    pass
