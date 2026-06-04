from enum import Enum

class FieldType(str, Enum):
    CHECKBOX = "checkbox"
    DATE = "date"
    DROPDOWN = "dropdown"
    EMAIL = "email"
    INITIALS = "initials"
    NAME = "name"
    RADIO = "radio"
    SIGNATURE = "signature"
    STAMP = "stamp"
    TEXT = "text"

    def __str__(self) -> str:
        return str(self.value)
