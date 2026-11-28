import os
import pandas as pd
from typing import Optional

class FileCsvPatcherClient:
    """Công cụ chỉnh sửa trực tiếp nội dung file CSV hoặc Excel tại dòng và cột chỉ định mà không cần giao diện GUI."""

    def __init__(self):
        pass

    def _resolve_file(self, file_path: str) -> pd.DataFrame:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Không tìm thấy file tại đường dẫn: {file_path}")
        
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.csv':
            try:
                return pd.read_csv(file_path)
            except Exception as e:
                return pd.read_csv(file_path, encoding='utf-8-sig')
        elif ext in ['.xlsx', '.xls']:
            return pd.read_excel(file_path)
        else:
            raise ValueError(f"Định dạng file không được hỗ trợ: {ext}. Chỉ chấp nhận .csv, .xlsx, .xls")

    def _save_file(self, df: pd.DataFrame, file_path: str) -> None:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.csv':
            df.to_csv(file_path, index=False, encoding='utf-8-sig')
        elif ext in ['.xlsx', '.xls']:
            try:
                df.to_excel(file_path, index=False, engine='openpyxl')
            except ImportError:
                raise RuntimeError("Thiếu thư viện openpyxl để ghi file Excel. Vui lòng cài đặt openpyxl.")

    def patch_cell(self, file_path: str, row_index: int, column_name_or_index: str, new_value: str) -> dict:
        """Sửa giá trị của một ô cụ thể trong file CSV hoặc Excel dựa vào chỉ số dòng (0-based) và tên cột hoặc chỉ số cột."""
        try:
            df = self._resolve_file(file_path)
            
            if row_index < 0 or row_index >= len(df):
                raise IndexError(f"Chỉ số dòng {row_index} vượt quá phạm vi file (0 đến {len(df)-1}).")

            col_target = column_name_or_index
            if str(col_target).isdigit():
                col_idx = int(col_target)
                if col_idx < 0 or col_idx >= len(df.columns):
                    raise IndexError(f"Chỉ số cột {col_idx} vượt quá phạm vi file (0 đến {len(df.columns)-1}).")
                col_name = df.columns[col_idx]
            else:
                if col_target not in df.columns:
                    raise ValueError(f"Không tìm thấy tên cột '{col_target}' trong file. Các cột hiện có: {list(df.columns)}")
                col_name = col_target

            # Ép kiểu dữ liệu mới phù hợp với kiểu dữ liệu sẵn có của cột (tránh lỗi LossySetitemError/TypeError của pandas khi gán string vào cột int/float)
            target_dtype = df[col_name].dtype
            try:
                if pd.api.types.is_integer_dtype(target_dtype):
                    converted_value = int(new_value)
                elif pd.api.types.is_float_dtype(target_dtype):
                    converted_value = float(new_value)
                elif pd.api.types.is_bool_dtype(target_dtype):
                    if isinstance(new_value, str):
                        converted_value = new_value.lower() in ['true', '1', 'yes', 't']
                    else:
                        converted_value = bool(new_value)
                else:
                    converted_value = new_value
            except (ValueError, TypeError):
                converted_value = new_value

            df.at[row_index, col_name] = converted_value
            
            self._save_file(df, file_path)

            return {
                "status": "success",
                "message": f"Đã cập nhật thành công ô [Dòng: {row_index}, Cột: {col_name}] thành '{new_value}'. File vẫn mở được bình thường.",
                "file_path": file_path
            }
        except Exception as e:
            raise RuntimeError(f"Lỗi khi patch file CSV/Excel: {str(e)}")

    def get_file_preview(self, file_path: str, nrows: int = 5) -> list[dict]:
        """Xem trước nội dung của file CSV hoặc Excel dưới dạng danh sách các dictionary."""
        try:
            df = self._resolve_file(file_path)
            preview_df = df.head(nrows)
            return preview_df.to_dict(orient="records")
        except Exception as e:
            raise RuntimeError(f"Lỗi khi đọc preview file: {str(e)}")
