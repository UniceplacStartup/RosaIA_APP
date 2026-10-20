from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field


class UserProfileResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    cpf_masked: str
    role: str
    is_active: bool
    terms_accepted_at: Optional[str] = None


class UserDataExportResponse(BaseModel):
    exportado_em: str
    base_legal: str
    titular: Dict[str, Any]
    conversas: List[Dict[str, Any]]
    lembretes: List[Dict[str, Any]]


class AccountDeleteRequest(BaseModel):
    confirmation_word: Optional[str] = Field(default=None, description="Deve ser exatamente 'EXCLUIR'")
    confirmation: Optional[str] = Field(default=None, description="Alias para confirmação")

    def get_confirmation(self) -> str:
        if self.confirmation_word:
            return self.confirmation_word
        if self.confirmation:
            return self.confirmation
        return ""
