import json
import jsonschema
from jsonschema import validate

class JSONSchemaValidator:
    def __init__(self, schema):
        """
        Khởi tạo bộ kiểm tra schema với một schema cụ thể.
        
        :param schema: Định nghĩa schema để kiểm tra.
        :type schema: dict
        """
        self.schema = schema

    def validate(self, data):
        """
        Kiểm tra xem dữ liệu có tuân thủ schema hay không.
        
        :param data: Dữ liệu cần kiểm tra.
        :type data: dict
        :return: Kết quả kiểm tra, True nếu hợp lệ, False nếu không hợp lệ.
        :rtype: bool
        :raises: ValueError nếu dữ liệu không hợp lệ.
        """
        try:
            validate(instance=data, schema=self.schema)
            return True
        except jsonschema.exceptions.ValidationError as ve:
            raise ValueError(f"Dữ liệu không hợp lệ: {ve.message}")