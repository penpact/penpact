from enum import Enum

class EnvelopeStatus(str, Enum):
    COMPLETED = "completed"
    DECLINED = "declined"
    DRAFT = "draft"
    EXPIRED = "expired"
    PARTIALLY_SIGNED = "partially_signed"
    SENT = "sent"
    VIEWED = "viewed"
    VOIDED = "voided"

    def __str__(self) -> str:
        return str(self.value)
