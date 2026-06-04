from enum import Enum

class WebhookEventType(str, Enum):
    ENVELOPE_COMPLETED = "envelope.completed"
    ENVELOPE_DECLINED = "envelope.declined"
    ENVELOPE_PARTIALLY_SIGNED = "envelope.partially_signed"
    ENVELOPE_SENT = "envelope.sent"
    ENVELOPE_VIEWED = "envelope.viewed"
    ENVELOPE_VOIDED = "envelope.voided"

    def __str__(self) -> str:
        return str(self.value)
