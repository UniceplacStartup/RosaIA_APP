from typing import Any, Optional
from fastapi import HTTPException, status


class RosaIABaseException(HTTPException):
    """Exceção base do ecossistema RosaIA APP."""

    def __init__(
        self,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        detail: Optional[str] = None,
        message: Optional[str] = None,
        headers: Optional[dict[str, str]] = None,
    ):
        msg = detail or message or "Erro de validação ou regra de negócio."
        super().__init__(status_code=status_code, detail=msg, headers=headers)


class LGPDImageBlockedException(RosaIABaseException):
    """
    Lançada quando qualquer tentativa de envio de foto, imagem médica ou DICOM
    é interceptada por MIME Type ou inspeção binária de Magic Bytes (HTTP 415).
    """

    def __init__(
        self,
        detail: str = (
            "Por conformidade estrita com a LGPD e respeito à sua privacidade, "
            "imagens e fotos médicas são proibidas no RosaIA APP. Por favor, envie "
            "apenas laudos em documento de texto ou PDF (.pdf, .txt, .docx)."
        ),
    ):
        super().__init__(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=detail)


class CPFInvalidException(RosaIABaseException):
    """Lançada quando o CPF não atende ao Módulo 11 oficial."""

    def __init__(self, detail: str = "O CPF informado não passou na validação oficial dos dígitos verificadores (Módulo 11)."):
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


class AuthenticationFailedException(RosaIABaseException):
    """Lançada em falha de login (credenciais incorretas) sem expor se o e-mail existe (OWASP A07)."""

    def __init__(self, detail: str = "Credenciais inválidas. Verifique seu e-mail e senha."):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class AccountLockedException(RosaIABaseException):
    """Lançada quando a conta foi temporariamente bloqueada por força bruta (OWASP A07)."""

    def __init__(self, lockout_minutes: Any = 15):
        if isinstance(lockout_minutes, int):
            msg = f"Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em {lockout_minutes} minutos."
        else:
            msg = str(lockout_minutes)
        super().__init__(
            status_code=status.HTTP_423_LOCKED,
            detail=msg,
        )


class WeakPasswordException(RosaIABaseException):
    """Lançada quando a senha não cumpre os requisitos do checklist OWASP."""

    def __init__(
        self,
        detail: str = (
            "A senha deve conter no mínimo 8 caracteres, incluindo pelo menos "
            "uma letra maiúscula, uma minúscula, um número e um caractere especial."
        ),
    ):
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


class AccountDeletionConfirmationException(RosaIABaseException):
    """Lançada quando a usuária não digita exatamente 'EXCLUIR' para confirmar hard delete."""

    def __init__(self, detail: str = "Confirmação inválida. Digite exatamente 'EXCLUIR' para confirmar a exclusão permanente."):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
