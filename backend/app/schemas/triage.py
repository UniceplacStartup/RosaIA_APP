from typing import List, Literal
from pydantic import BaseModel, Field

AgeRangeLiteral = Literal["menos_40", "40_49", "50_69", "70_mais"]
AttentionLevelLiteral = Literal["rotina_preventiva", "atencao_moderada", "avaliacao_prioritaria"]


class TriageInput(BaseModel):
    age_range: AgeRangeLiteral = Field(..., description="Faixa etária da paciente")
    has_family_history: bool = Field(default=False, description="Histórico de 1º grau (mãe, irmã ou filha)")
    reported_signs: List[str] = Field(default_factory=list, description="Lista de sintomas relatados")


class TriageResult(BaseModel):
    attention_level: AttentionLevelLiteral
    label: str
    guidance: str
    educational_only: bool = True
