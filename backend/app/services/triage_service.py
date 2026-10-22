from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.triage import TriageAssessment
from app.db.models.user import User
from app.schemas.triage import TriageInput, TriageResult
from app.ai.prompts import clean_rosa_text


def build_detailed_empathetic_triage_guidance(data: TriageInput) -> str:
    """
    Constrói orientação altamente específica, acolhedora, sincera e humana,
    eliminando tom vago ou frio e sem nenhum asterisco (*) ou hashtag (#).
    """
    parts = []

    parts.append(
        "Olá, querida! Analisei com todo o carinho e atenção os dados da sua triagem mamária. "
        "Estou aqui para te acolher, esclarecer suas dúvidas com sinceridade e te orientar com base nas melhores diretrizes de saúde."
    )

    # Análise de Faixa Etária
    age = data.age_range
    if age == "menos_40":
        parts.append(
            "Em relação à sua idade (menos de 40 anos): o tecido mamário costuma ser mais denso e pequenas oscilações, "
            "dores passageiras ou nódulos são muito comuns e quase sempre ligados a fatores hormonais benignos."
        )
    elif age == "40_49":
        parts.append(
            "Em relação à sua idade (40 a 49 anos): este é o momento de estabelecer uma rotina anual de cuidado clínico com seu "
            "mastologista ou ginecologista para acompanhamento preventivo regular."
        )
    elif age == "50_69":
        parts.append(
            "Em relação à sua idade (50 a 69 anos): você está na faixa etária prioritária indicada pelo Ministério da Saúde e pelo INCA "
            "para o rastreamento bienal com mamografia. Esse exame de rotina é simples e garante diagnósticos precoces com enorme tranquilidade."
        )
    else:
        parts.append(
            "Em relação à sua idade (70 anos ou mais): o diálogo com seu médico assistente é essencial para personalizar seus exames de rotina de acordo com seu bem-estar."
        )

    # Análise dos Sintomas relatados
    has_symptoms = len(data.reported_signs) > 0
    if has_symptoms:
        symptoms_str = ", ".join(data.reported_signs)
        symptom_details = []

        lower_signs = [s.lower() for s in data.reported_signs]
        if any("caroço" in s or "nódulo" in s or "nodulo" in s for s in lower_signs):
            symptom_details.append(
                "Sobre o nódulo ou caroço relatado: sei que sentir uma alteração pode assustar, mas respire com calma. "
                "Cerca de 80% das alterações e nódulos nas mamas são completamente benignos (como cistos de líquido ou fibroadenomas). "
                "Agendar uma consulta médica presencial é o passo seguro para que o profissional examine a área e solicite o exame apropriado."
            )
        if any("dor" in s for s in lower_signs):
            symptom_details.append(
                "Sobre a dor mamária relatada: a mastalgia é um sintoma muito frequente no dia a dia das mulheres e raramente está associada a doenças graves, sendo normalmente consequência de oscilações normais do ciclo."
            )
        if any("pele" in s or "vermelhidão" in s or "vermelhidao" in s for s in lower_signs):
            symptom_details.append(
                "Sobre a alteração na pele: o médico irá inspecionar a textura do tecido mamário de forma presencial para afastar qualquer processo inflamatório."
            )
        if any("secreção" in s or "secrecao" in s or "mamilo" in s for s in lower_signs):
            symptom_details.append(
                "Sobre a alteração ou secreção no mamilo: levar essa observação ao médico garante uma análise cuidadosa das características do líquido."
            )

        if not symptom_details:
            symptom_details.append(
                f"Identificamos os sinais relatados ({symptoms_str}) que merecem avaliação presencial com seu médico na UBS ou clínica."
            )

        parts.append("\n\n".join(symptom_details))
    else:
        parts.append(
            "Fico muito feliz em saber que você não observou nódulos, dores ou sinais incomuns recentemente. "
            "Manter o autocuidado e o olhar atento ao seu corpo é um ato valioso de proteção."
        )

    # Análise do Histórico Familiar
    if data.has_family_history:
        parts.append(
            "Sobre o histórico familiar de primeiro grau (mãe, irmã ou filha): acolho a vivência da sua família com muito respeito. "
            "Ter parentes de primeiro grau com diagnóstico anterior não significa que você terá o mesmo diagnóstico. "
            "Significa apenas que o médico começará a rotina preventiva de acompanhamento mais precocemente, com todo o zelo."
        )
    else:
        parts.append(
            "A ausência de histórico familiar de primeiro grau é um elemento bastante tranquilizador no seu histórico."
        )

    # Conclusão e Fechamento
    parts.append(
        "Lembre-se sempre de que quando cuidamos da nossa saúde precocemente, as taxas de cura ultrapassam 95%. "
        "Você não está sozinha nesta caminhada. Estou com você no chat para conversarmos sobre qualquer dúvida, sentimento ou orientação adicional que você desejar."
    )

    full_text = "\n\n".join(parts)
    return clean_rosa_text(full_text)


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
    elif has_symptoms:
        level = "avaliacao_prioritaria"
        label = "Avaliação Médica Prioritária com Acolhimento"
    else:
        level = "atencao_moderada"
        label = "Atenção Preventiva Individualizada"

    guidance = build_detailed_empathetic_triage_guidance(data)

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
