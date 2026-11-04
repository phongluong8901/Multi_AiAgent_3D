from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.base import Base


def _build_resilient_engine():
    """
    Khởi tạo kết nối tới Neon PostgreSQL:
    1. Ưu tiên kết nối tới `DATABASE_URL` (`firmware_db` trên Neon).
    2. Nếu `firmware_db` chưa được tạo trên Neon Console, tự động thử kết nối sang `FALLBACK_DATABASE_URL` (`agents_db` trên Neon, dùng tiền tố bảng `firmware_*`).
    3. Nếu hoàn toàn mất mạng internet khi dev offline, dự phòng sang SQLite cục bộ để service không bao giờ crash.
    """
    candidates = [
        ("Neon firmware_db", settings.DATABASE_URL),
        ("Neon agents_db (shared firmware_* tables)", settings.FALLBACK_DATABASE_URL),
        ("Local SQLite Fallback", "sqlite:///./firmware_local.db"),
    ]

    for label, db_url in candidates:
        if not db_url:
            continue
        try:
            connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
            eng = create_engine(db_url, pool_pre_ping=True, connect_args=connect_args)
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"[agent-firmware DB] ✅ Connected to {label}")
            return eng
        except Exception as exc:
            print(f"[agent-firmware DB] ⚠️ Could not connect to {label}: {exc}")

    return create_engine("sqlite:///./firmware_local.db", connect_args={"check_same_thread": False})


engine = _build_resilient_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
