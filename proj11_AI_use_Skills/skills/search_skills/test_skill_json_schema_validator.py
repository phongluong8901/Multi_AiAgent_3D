import pytest
from skill_json_schema_validator import JSONSchemaValidator

# Define test schemas and data
valid_schema = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "age": {"type": "integer"}
    },
    "required": ["name", "age"]
}

invalid_schema = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "age": {"type": "integer"}
    },
    "required": ["name", "age", "non_existent_field"]
}

valid_data = {
    "name": "John Doe",
    "age": 30
}

invalid_data_missing_field = {
    "name": "John Doe"
}

invalid_data_wrong_type = {
    "name": "John Doe",
    "age": "thirty"
}

def test_validate_happy_path():
    validator = JSONSchemaValidator(valid_schema)
    assert validator.validate(valid_data) == True

def test_validate_missing_field():
    validator = JSONSchemaValidator(valid_schema)
    with pytest.raises(ValueError):
        validator.validate(invalid_data_missing_field)

def test_validate_wrong_type():
    validator = JSONSchemaValidator(valid_schema)
    with pytest.raises(ValueError):
        validator.validate(invalid_data_wrong_type)

def test_validate_invalid_schema():
    validator = JSONSchemaValidator(invalid_schema)
    with pytest.raises(ValueError):
        validator.validate(valid_data)

def test_validate_empty_data():
    validator = JSONSchemaValidator(valid_schema)
    with pytest.raises(ValueError):
        validator.validate({})

def test_validate_none_data():
    validator = JSONSchemaValidator(valid_schema)
    with pytest.raises(ValueError):
        validator.validate(None)