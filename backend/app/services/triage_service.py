from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.triage import TriageAssessment
from app.db.models.user import User
from app.schemas.triage import TriageInput, TriageResult
from app.ai.prompts import clean_rosa_text

GENDER_GUIDANCE = {
    "homem": (
        "Você informou ser homem. Homens também têm tecido mamário: o câncer de mama é raro neles (cerca de 1% dos casos), "
        "mas qualquer caroço, secreção ou alteração no mamilo merece avaliação médica. Já o aumento benigno do tecido mamário "
        "(ginecomastia) é bem comum. A mamografia de rotina geralmente não é indicada sem fatores de risco, como histórico "
        "familiar ou alterações genéticas (por exemplo BRCA); o médico define o melhor caminho para você."
    ),
    "mulher_trans": (
        "Você informou ser mulher transgênero. Se você faz ou já fez terapia hormonal feminilizante, isso pode influenciar o tecido mamário. "
        "Em geral, as orientações atuais sugerem considerar a mamografia a partir dos 50 anos e após alguns anos de hormonioterapia, "
        "mas o seu médico individualiza essa decisão. Vale sempre ficar atenta a qualquer mudança nas mamas e contar ao médico sobre os hormônios que usa."
    ),
    "homem_trans": (
        "Você informou ser homem transgênero. Se você ainda tem tecido mamário, o acompanhamento costuma seguir as recomendações para pessoas com mamas por faixa etária. "
        "Se já fez mastectomia, ainda pode restar uma pequena quantidade de tecido, então caroços ou mudanças no peitoral, na cicatriz ou na axila também devem ser avaliados. "
        "Informe ao médico se usa testosterona e quando foi a cirurgia, caso tenha feito."
    ),
}


def build_detailed_empathetic_triage_guidance(data: TriageInput) -> str:
    """
    Constrói orientação altamente específica, acolhedora, sincera e humana,
    eliminando tom vago ou ríspido e sem nenhum asterisco (*) ou hashtag (#).
    Sem expressões confusas como 'ver esse resultado'.
    """
    parts = []

    parts.append(
        "Olá, querida! Analisei com todo o carinho e atenção cada detalhe da sua triagem mamária. "
        "Estou aqui ao seu lado para te acolher, esclarecer suas dúvidas com sinceridade e orientar com serenidade."
    )

    gender_text = GENDER_GUIDANCE.get((data.gender or "").lower())
    if gender_text:
        parts.append(gender_text)

    # Análise de Faixa Etária
    age = data.age_range
    if age == "menos_40":
        parts.append(
            "Em relação à sua faixa etária (menos de 40 anos): o tecido mamário costuma ser naturalmente mais denso e pequenas alterações, "
            "sensibilidades ou nódulos são frequentes e quase sempre ligados a fatores hormonais benignos, como cistos simples."
        )
    elif age == "40_49":
        parts.append(
            "Em relação à sua faixa etária (40 a 49 anos): este é o período de consolidar consultas preventivas anuais com seu "
            "mastologista ou ginecologista para acompanhamento regular e personalizado."
        )
    elif age == "50_69":
        parts.append(
            "Em relação à sua faixa etária (50 a 69 anos): você está na faixa prioritária estabelecida pelo Ministério da Saúde e pelo INCA "
            "para o rastreamento bienal com mamografia. Esse cuidado periódico é o seu maior aliado de tranquilidade."
        )
    elif age == "70_mais":
        parts.append(
            "Em relação à sua faixa etária (70 anos ou mais): o diálogo com seu médico assistente permite definir a periodicidade mais confortável e segura para o seu bem-estar."
        )

    # Análise dos Sintomas relatados
    real_symptoms = [s for s in data.reported_signs if "nenhum" not in s.lower()]
    has_symptoms = len(real_symptoms) > 0

    if has_symptoms:
        symptom_details = []
        lower_signs = [s.lower() for s in real_symptoms]

        if any("caroço" in s or "nódulo" in s or "nodulo" in s for s in lower_signs):
            symptom_details.append(
                "Sobre o nódulo ou caroço relatado: sei que sentir uma alteração palpável pode assustar, mas respire fundo. "
                "Cerca de 80% das alterações e nódulos nas mamas são completamente benignos (como cistos de água ou fibroadenomas). "
                "O exame físico presencial com o médico trará toda a clareza e segurança necessárias."
            )
        if any("axila" in s for s in lower_signs):
            symptom_details.append(
                "Sobre o nódulo ou alteração na axila: muitas vezes trata-se de um linfonodo reacional benigno a pequenas inflamações da pele, "
                "mas deve ser examinado pelo médico durante a sua consulta."
            )
        if any("tamanho" in s or "formato" in s for s in lower_signs):
            symptom_details.append(
                "Sobre a mudança percebida no formato ou tamanho da mama: é muito importante que o especialista observe essa alteração para avaliar a simetria."
            )
        if any("casca de laranja" in s or "pele" in s for s in lower_signs):
            symptom_details.append(
                "Sobre o aspecto na pele: o médico irá inspecionar de perto para afastar processos inflamatórios comuns e orientar o tratamento adequado."
            )
        if any("ferida" in s or "descamação" in s or "descamacao" in s or "mamilo" in s for s in lower_signs):
            symptom_details.append(
                "Sobre a alteração ou descamação no mamilo: levar essa observação ao mastologista é fundamental para avaliar a região com delicadeza."
            )
        if any("dor" in s for s in lower_signs):
            symptom_details.append(
                "Sobre a dor mamária: a mastalgia é um sintoma comum na rotina da mulher, geralmente ligada a variações normais dos hormônios."
            )

        if not symptom_details:
            symptoms_str = ", ".join(real_symptoms)
            symptom_details.append(
                f"Identificamos os sinais mencionados ({symptoms_str}), que merecem avaliação presencial cuidadosa na UBS ou consultório."
            )

        # Contexto de lado e duração caso informados
        extras = []
        if data.symptom_side and data.symptom_side != "prefiro_nao_informar":
            extras.append(f"Lado observado: {data.symptom_side}")
        if data.symptom_duration and data.symptom_duration != "prefiro_nao_informar":
            extras.append(f"Tempo de percepção: {data.symptom_duration}")
        if extras:
            symptom_details.append("Detalhes complementares registrados: " + " • ".join(extras) + ".")

        parts.append("\n\n".join(symptom_details))
    else:
        parts.append(
            "Fico muito feliz em saber que você não observou nenhum sintoma incomum recentemente. "
            "Manter o autocuidado com carinho e o olhar atento ao seu corpo é um gesto valioso de prevenção."
        )

    # Análise de Histórico Familiar
    has_fam = data.has_family_history is True or (data.family_history_option and "sim" in data.family_history_option.lower())
    if has_fam:
        parts.append(
            "Sobre o histórico familiar de primeiro grau (mãe, irmã ou filha): acolho essa vivência com profundo respeito. "
            "Ter familiares com histórico não significa que você terá o mesmo caminho; significa apenas que sua rotina preventiva será acompanhada de forma mais atenta e personalizada pelo médico."
        )
    elif data.family_history_option == "nao":
        parts.append(
            "A ausência de histórico familiar de primeiro grau é um ponto muito favorável no seu acompanhamento."
        )

    # Perguntas gentis de acompanhamento e acolhimento humano
    if has_symptoms:
        parts.append(
            "Lembre-se sempre: quando cuidamos da nossa saúde precocemente, as taxas de cura superam 95%. Você não está sozinha e estou aqui com você.\n\n"
            "Para que eu possa te acolher ainda melhor: quer me contar em qual mama você notou, há quanto tempo percebeu esse sinal, "
            "ou se notou dor ou alguma secreção? Como você está se sentindo neste momento?"
        )
    else:
        parts.append(
            "Lembre-se sempre de que o autocuidado e o diagnóstico precoce garantem taxas de cura acima de 95%.\n\n"
            "Como você está se sentindo? Quer me contar mais sobre a sua rotina ou tirar alguma dúvida comigo?"
        )

    full_text = "\n\n".join(parts)
    return clean_rosa_text(full_text)


async def process_triage(db: AsyncSession, user: User, data: TriageInput) -> TriageResult:
    """
    Estratifica o risco de atenção mamária com base nas recomendações do INCA/Ministério da Saúde.
    Grava o histórico na tabela triage_assessments para acompanhamento contínuo.
    """
    real_symptoms = [s for s in data.reported_signs if "nenhum" not in s.lower()]
    has_symptoms = len(real_symptoms) > 0
    has_family = data.has_family_history is True or (data.family_history_option and "sim" in data.family_history_option.lower())

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
        has_family_history=has_family,
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
