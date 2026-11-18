from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator

Slug = Annotated[str, StringConstraints(min_length=3, max_length=40, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")]
Password = Annotated[str, StringConstraints(min_length=12, max_length=128)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
Token = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{43}$")]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("*", mode="before")
    @classmethod
    def forbid_null_bytes(cls, value):
        if isinstance(value, str) and "\x00" in value:
            raise ValueError("Carácter inválido.")
        return value


class EmailInput(Input):
    email: Annotated[EmailStr, Field(max_length=254)]


class Register(EmailInput):
    name: Name
    slug: Slug
    password: Password
    accept_terms: Literal[True]


class Login(EmailInput):
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class Verify(Input):
    token: Token


class ConfirmEmail(Verify):
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class Reset(Verify):
    password: Password


class DeleteAccount(Input):
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class ProfileData(Input):
    name: Name
    slug: Slug
    academic_role: Literal["other", "researcher", "teacher", "student"] = "other"
    institution: str = Field(default="", max_length=160)
    country: str = Field(default="", max_length=80)
    city: str = Field(default="", max_length=80)
    specialization: str = Field(default="", max_length=160)
    interests: str = Field(default="", max_length=400)
    biography: str = Field(default="", max_length=2000)
    orcid: str = Field(default="", pattern=r"^(?:[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X])?$")
    is_public: bool = False

    @field_validator("orcid")
    @classmethod
    def validate_orcid(cls, value: str) -> str:
        if not value:
            return value
        digits = value.replace("-", "")
        total = 0
        for digit in digits[:-1]:
            total = (total + int(digit)) * 2
        check = (12 - total % 11) % 11
        if digits[-1] != ("X" if check == 10 else str(check)):
            raise ValueError("Dígito de controlo ORCID inválido.")
        return value


class MyProfile(ProfileData):
    email: EmailStr
