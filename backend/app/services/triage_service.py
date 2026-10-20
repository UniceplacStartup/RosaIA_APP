from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.triage import TriageAssessment
from app.db.models.user import User
from app.schemas.triage import TriageInput, TriageResult


async def process_triage(db: AsyncSession, user: User, data: TriageInput) -> TriageResult:
    """
    Estratifica o risco de atenção mamária com base nas recomendações do INCA/Ministério da Saúde.
    Grava o histórico na tabela triage_assessments para acompanhamento contínuo.
    """
    has_symptoms = len(data.reported_signs) > 0
    has_family = data.has_family_history

    if not has_symptoms and not has_family:
        level = "rotina_preventiva"
        label = "Rotina Preventiva"
        guidance = (
            "Você não relatou sinais de alerta imediatos. Continue realizando seus exames preventivos "
            "conforme a faixa etária recomendada pelo Ministério da Saúde e pelo INCA (mamografia bienal entre 50 e 69 anos)."
        )
    elif has_symptoms:
        level = "avaliacao_prioritaria"
        label = "Avaliação Médica Prioritária (Sem Pânico)"
        factors = ", ".join(data.reported_signs)
        guidance = (
            f"Identificamos sinais relatados ({factors}) que merecem avaliação clínica presencial com seu médico(a). "
            "Lembre-se: cerca de 80% das alterações mamárias são benignas e têm tratamento eficaz. "
            "Agendar uma consulta na UBS ou clínica garante diagnóstico precoce e tranquilidade."
        )
    else:
        level = "atencao_moderada"
        label = "Atenção Moderada (Histórico Familiar)"
        guidance = (
            "Por relatar histórico familiar de 1º grau (mãe, irmã ou filha), recomenda-se acompanhamento personalizado "
            "a partir dos 35 anos ou conforme a orientação do seu mastologista/ginecologista."
        )

    # Persiste a triagem
    assessment = TriageAssessment(
        user_id=user.id,
        age_range=data.age_range,
        has_family_history=data.has_family_history,
        reported_signs=data.reported_signs,
        emotional_impact_level=3 if has_symptoms else 1,
        attention_level=level,
        ai_guidance_summary=guidance,
    )
    db.add(assessment)
    await db.commit()

    return TriageResult(
        attention_level=level,
        label=label,
        guidance=guidance,
        educational_only=True,
    )
