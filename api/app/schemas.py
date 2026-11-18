import base64
import re
from urllib.parse import urlsplit
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


def image_data(value: str) -> str:
    if not value:
        return value
    match = re.fullmatch(r"data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})", value)
    if not match:
        raise ValueError("Use uma imagem PNG, JPEG ou WebP.")
    content = base64.b64decode(match[2], validate=True)
    kind = match[1]
    if not (
        (kind == "png" and content.startswith(b"\x89PNG\r\n\x1a\n"))
        or (kind == "jpeg" and content.startswith(b"\xff\xd8\xff"))
        or (kind == "webp" and content[:4] == b"RIFF" and content[8:12] == b"WEBP")
    ):
        raise ValueError("Formato de imagem inválido.")
    return value


def web_url(value: str) -> str:
    if value:
        parsed = urlsplit(value)
        if parsed.scheme not in {"https", "http"} or not parsed.hostname or parsed.username is not None:
            raise ValueError("Introduza um endereço HTTP ou HTTPS válido.")
        if any(char.isspace() for char in value) or "\\" in value:
            raise ValueError("Endereço inválido.")
    return value


class SocialLink(Input):
    platform: Literal["Facebook", "Instagram", "X", "LinkedIn", "Outra"]
    url: Annotated[str, Field(min_length=1, max_length=500)]
    public: bool = True

    _url = field_validator("url")(web_url)


class KeywordsInput(Input):
    keywords: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]] = Field(default_factory=list, max_length=12)

    @field_validator("keywords")
    @classmethod
    def validate_keywords(cls, values):
        if any("\x00" in value for value in values):
            raise ValueError("Carácter inválido.")
        return list(dict.fromkeys(values))


class ProfileData(KeywordsInput):
    name: Name
    slug: Slug
    academic_role: Literal["other", "researcher", "teacher", "student"] = "other"
    institution: str = Field(default="", max_length=160)
    country: str = Field(default="", max_length=80)
    city: str = Field(default="", max_length=80)
    specialization: str = Field(default="", max_length=160)
    interests: str = Field(default="", max_length=400)
    biography: str = Field(default="", max_length=2000)
    education: str = Field(default="", max_length=2000)
    experience: str = Field(default="", max_length=2000)
    publications: str = Field(default="", max_length=2000)
    orcid: str = Field(default="", pattern=r"^(?:[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X])?$")
    photo: str = Field(default="", max_length=360_000)
    social_links: list[SocialLink] = Field(default_factory=list, max_length=8)
    is_public: bool = False

    _photo = field_validator("photo")(image_data)

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


class ChangePassword(DeleteAccount):
    new_password: Password


class ChangeEmail(EmailInput):
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]
