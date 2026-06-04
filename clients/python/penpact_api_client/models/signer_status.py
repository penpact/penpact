from enum import Enum

class SignerStatus(str, Enum):
    DECLINED = "declined"
    PENDING = "pending"
    SENT = "sent"
    SIGNED = "signed"
    VIEWED = "viewed"

    def __str__(self) -> str:
        return str(self.value)
