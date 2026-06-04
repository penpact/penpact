from enum import Enum

class SignatureType(str, Enum):
    ADOPTED = "adopted"
    DRAWN = "drawn"
    TYPED = "typed"
    UPLOADED = "uploaded"

    def __str__(self) -> str:
        return str(self.value)
