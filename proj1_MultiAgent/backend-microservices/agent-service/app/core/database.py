"""
Module thiet lap ket noi co so du lieu PostgreSQL cho Agent Service (`database.py`).
Su dung SQLAlchemy engine voi pool_pre_ping=True de kiem tra tinh song con cua ket noi truoc khi thuc thi truy van.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.base import Base

# Khoi tao SQLAlchemy Engine ket noi toi PostgreSQL
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

# Factory tao session lam viec voi database
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """
    Dependency Generator cung cap SQLAlchemy Session cho cac FastAPI endpoints.
    Dam bao session luon duoc dong (`close`) an toan sau khi xu ly xong request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
