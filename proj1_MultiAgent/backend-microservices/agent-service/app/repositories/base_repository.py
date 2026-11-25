"""
Lớp Repository cơ sở (`BaseRepository`) đóng gói các thao tác CRUD chung với SQLAlchemy Session.
"""

from sqlalchemy.orm import Session
from typing import Generic, TypeVar, Type, List, Optional

ModelType = TypeVar("ModelType")


class BaseRepository(Generic[ModelType]):
    """
    Repository tổng quát cho các bảng SQLAlchemy có khóa chính là `id`.
    Cung cấp các phương thức truy vấn đơn lẻ (`get`), danh sách (`get_all`),
    thêm mới (`create`), cập nhật (`update`) và xóa (`delete`).
    """

    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get(self, db: Session, id: str) -> Optional[ModelType]:
        """Truy vấn một bản ghi theo khóa chính `id`."""
        id_col = getattr(self.model, "id")
        return db.query(self.model).filter(id_col == id).first()

    def get_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[ModelType]:
        """Truy vấn danh sách bản ghi có phân trang (`skip`, `limit`)."""
        return db.query(self.model).offset(skip).limit(limit).all()

    def create(self, db: Session, obj_in_data: dict) -> ModelType:
        """Khởi tạo và lưu một bản ghi mới vào cơ sở dữ liệu."""
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: ModelType, update_data: dict) -> ModelType:
        """Cập nhật các trường dữ liệu của một bản ghi hiện có."""
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, id: str) -> bool:
        """Xóa một bản ghi theo `id`, trả về `True` nếu xóa thành công."""
        obj = self.get(db, id)
        if obj:
            db.delete(obj)
            db.commit()
            return True
        return False
