import os
import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from skill_file_csv_patcher import FileCsvPatcherClient

@pytest.fixture
def client():
    return FileCsvPatcherClient()

def test_patch_cell_csv_success(tmp_path, client):
    # Tạo file CSV tạm thời
    d = tmp_path / "sub"
    d.mkdir()
    file_path = d / "test.csv"
    
    df_orig = pd.DataFrame({"Name": ["Alice", "Bob"], "Age": [25, 30]})
    df_orig.to_csv(file_path, index=False)
    
    # Patch cell
    result = client.patch_cell(str(file_path), row_index=1, column_name_or_index="Age", new_value="35")
    
    assert result["status"] == "success"
    
    # Kiểm tra lại nội dung file đã được ghi đúng
    df_updated = pd.read_csv(file_path)
    assert df_updated.loc[1, "Age"] == 35
    assert df_updated.loc[0, "Name"] == "Alice"

def test_patch_cell_excel_by_index_success(tmp_path, client):
    file_path = tmp_path / "test.xlsx"
    df_orig = pd.DataFrame({"Prod": ["A", "B"], "Price": [100, 200]})
    df_orig.to_excel(file_path, index=False)
    
    # Patch bằng chỉ số cột (ví dụ cột 1 là Price)
    result = client.patch_cell(str(file_path), row_index=0, column_name_or_index="1", new_value="150")
    
    assert result["status"] == "success"
    df_updated = pd.read_excel(file_path)
    assert df_updated.loc[0, "Price"] == 150

def test_file_not_found(client):
    with pytest.raises(RuntimeError) as excinfo:
        client.patch_cell("non_existent_file_abc123.csv", 0, "Name", "Test")
    assert "Không tìm thấy file" in str(excinfo.value)

def test_invalid_extension(tmp_path, client):
    bad_file = tmp_path / "test.txt"
    bad_file.write_text("hello")
    with pytest.raises(RuntimeError) as excinfo:
        client.patch_cell(str(bad_file), 0, "Col", "Val")
    assert "Định dạng file không được hỗ trợ" in str(excinfo.value)

def test_out_of_bound_row(tmp_path, client):
    file_path = tmp_path / "test.csv"
    pd.DataFrame({"A": [1]}).to_csv(file_path, index=False)
    
    with pytest.raises(RuntimeError) as excinfo:
        client.patch_cell(str(file_path), row_index=5, column_name_or_index="A", new_value="2")
    assert "vượt quá phạm vi file" in str(excinfo.value)

def test_invalid_column_name(tmp_path, client):
    file_path = tmp_path / "test.csv"
    pd.DataFrame({"A": [1]}).to_csv(file_path, index=False)
    
    with pytest.raises(RuntimeError) as excinfo:
        client.patch_cell(str(file_path), row_index=0, column_name_or_index="NonExistent", new_value="2")
    assert "Không tìm thấy tên cột" in str(excinfo.value)

def test_get_file_preview(tmp_path, client):
    file_path = tmp_path / "test.csv"
    pd.DataFrame({"A": [1, 2], "B": [3, 4]}).to_csv(file_path, index=False)
    
    preview = client.get_file_preview(str(file_path), nrows=1)
    assert len(preview) == 1
    assert preview[0]["A"] == 1
    assert preview[0]["B"] == 3
