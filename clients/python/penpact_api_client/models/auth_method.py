from enum import Enum

class AuthMethod(str, Enum):
    ACCESS_CODE = "access_code"
    EMAIL_LINK = "email_link"
    EMAIL_OTP = "email_otp"
    ID_VERIFICATION = "id_verification"
    SMS_OTP = "sms_otp"

    def __str__(self) -> str:
        return str(self.value)
