import logging
import os
import smtplib
import ssl
from email.message import EmailMessage

from fastapi import HTTPException

from .security import APP_ORIGIN

logger = logging.getLogger(__name__)


def send_link(address: str, purpose: str, secret: str):
    route, title = {
        "verify": ("confirmar-email", "Confirme o seu endereço de email"),
        "reset": ("nova-palavra-passe", "Redefina a sua palavra-passe"),
    }[purpose]
    message = EmailMessage()
    message["From"] = os.getenv("SMTP_FROM", "SSciX <contas@sscix.example>")
    message["To"] = address
    message["Subject"] = f"SSciX · {title}"
    message.set_content(f"{title}\n\n{APP_ORIGIN}/{route}#token={secret}\n\n"
                        "Se não fez este pedido, pode ignorar esta mensagem.")
    try:
        with smtplib.SMTP(os.getenv("SMTP_HOST", "127.0.0.1"), int(os.getenv("SMTP_PORT", "1025")), timeout=5) as smtp:
            if os.getenv("SMTP_STARTTLS") == "1":
                smtp.starttls(context=ssl.create_default_context())
            if username := os.getenv("SMTP_USER"):
                smtp.login(username, os.environ["SMTP_PASSWORD"])
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException):
        logger.warning("Falha na entrega de email transacional (%s)", purpose)
        raise HTTPException(503, "O serviço de email está temporariamente indisponível.") from None
