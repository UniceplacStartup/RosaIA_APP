from typing import Dict, Tuple

FEAR_KEYWORDS = [
    "medo", "assustada", "apavorada", "pavor", "morrer", "morte", "pior",
    "angústia", "angustia", "ansiosa", "ansiedade", "chorando", "triste",
    "desesperada", "pânico", "panico", "socorro", "aflita",
]

SYMPTOM_KEYWORDS = [
    "caroço", "caroco", "nódulo", "nodulo", "bolinha", "dor", "secreção",
    "secrecao", "mamilo", "vermelhidão", "vermelhidao", "inchaço", "inchaco",
    "pele casca de laranja", "retração", "retracao",
]

EXAM_KEYWORDS = [
    "bi-rads", "birads", "laudo", "mamografia", "ultrassom", "ecografia",
    "microcalcificações", "microcalcificacoes", "cisto", "fibroadenoma",
]


def analyze_emotional_state(text: str) -> Tuple[str, bool, Dict[str, bool]]:
    """
    Classificador NLU de sentimentos e gatilhos de sofrimento psíquico da paciente.
    Identifica se o protocolo de suporte psicológico intensivo deve ser ativado.
    Retorna:
    - current_emotional_state (str)
    - psychological_support_triggered (bool)
    - context_flags (dict)
    """
    lower = text.lower()
    has_fear = any(w in lower for w in FEAR_KEYWORDS)
    has_symptom = any(w in lower for w in SYMPTOM_KEYWORDS)
    has_exam = any(w in lower for w in EXAM_KEYWORDS)

    if has_fear and has_symptom:
        state = "medo_ansiedade"
        triggered = True
    elif has_fear:
        state = "medo_ansiedade"
        triggered = True
    elif has_symptom:
        state = "duvida_exame"
        triggered = False
    elif has_exam:
        state = "duvida_exame"
        triggered = False
    else:
        state = "acolhimento_inicial"
        triggered = False

    return state, triggered, {
        "has_fear": has_fear,
        "has_symptom": has_symptom,
        "has_exam": has_exam,
    }
