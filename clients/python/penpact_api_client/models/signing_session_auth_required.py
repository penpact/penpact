from enum import Enum

class SigningSessionAuthRequired(str, Enum):
    ACCESS_CODE = "access_code"
    EMAIL_OTP = "email_otp"

    def __str__(self) -> str:
        return str(self.value)
