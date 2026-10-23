from typing import List, Literal, Optional, Dict, Any
from pydantic import BaseModel, Field

AgeRangeLiteral = Literal["menos_40", "40_49", "50_69", "70_mais", "prefiro_nao_informar"]
AttentionLevelLiteral = Literal["rotina_preventiva", "atencao_moderada", "avaliacao_prioritaria"]


class TriageInput(BaseModel):
    age_range: str = Field(default="50_69", description="Faixa etária da paciente")
    has_family_history: Optional[bool] = Field(default=None, description="Histórico familiar booleano")
    family_history_option: Optional[str] = Field(default="nao", description="Opção: sim, nao ou prefiro_nao_informar")
    reported_signs: List[str] = Field(default_factory=list, description="Lista de sintomas relatados")
    
    # Seletores complementares de sintomas
    symptom_side: Optional[str] = Field(default=None, description="Direita, Esquerda, Ambas, Prefiro não informar")
    symptom_duration: Optional[str] = Field(default=None, description="Menos de 1 semana, 1 a 4 semanas, Mais de 1 mês, Prefiro não informar")

    # Novas Perguntas Clínicas e de Contexto
    pregnancy_breastfeeding: Optional[str] = Field(default="prefiro_nao_informar", description="Grávida ou amamentando: sim, nao, prefiro_nao_informar")
    hormones_meds: Optional[str] = Field(default="prefiro_nao_informar", description="Anticoncepcional/reposição hormonal: sim, nao, ja_usei, prefiro_nao_informar")
    menopause: Optional[str] = Field(default="prefiro_nao_informar", description="Menopausa: sim, nao, nao_sei, prefiro_nao_informar")
    chest_radiotherapy: Optional[str] = Field(default="prefiro_nao_informar", description="Radioterapia no tórax: sim, nao, prefiro_nao_informar")
    lifestyle_smoking: Optional[str] = Field(default="prefiro_nao_informar", description="Fumo: frequencia ou prefiro_nao_informar")
    lifestyle_alcohol: Optional[str] = Field(default="prefiro_nao_informar", description="Álcool: frequencia ou prefiro_nao_informar")
    lifestyle_activity: Optional[str] = Field(default="prefiro_nao_informar", description="Atividade física: frequencia ou prefiro_nao_informar")
    regular_medical_followup: Optional[str] = Field(default="prefiro_nao_informar", description="Acompanhamento mastologista/ginecologista: sim, nao, prefiro_nao_informar")
    emotional_impact_level: Optional[int] = Field(default=None)


class TriageResult(BaseModel):
    attention_level: AttentionLevelLiteral
    label: str
    guidance: str
    educational_only: bool = True

