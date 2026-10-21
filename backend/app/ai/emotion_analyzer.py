import json
import logging
from typing import Any, Dict, Literal, Tuple

from pydantic import BaseModel, Field

logger = logging.getLogger("rosaia.ai.emotion")

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


def analyze_emotional_state_dict(text: str) -> Dict[str, Any]:
    """Versão por regras com retorno em dicionário (usada como fallback do LLM)."""
    state, triggered, flags = analyze_emotional_state(text)
    return {
        "sentiment": state,
        "psychological_support_triggered": triggered,
        "intensity": 7 if triggered else 3,
        "flags": flags,
        "source": "rules",
    }


EMOTION_LABELS = ("acolhimento_inicial", "medo_ansiedade", "duvida_exame", "tristeza", "esperanca_alivio")

EMOTION_SYSTEM_PROMPT = (
    "Você é um classificador clínico-emocional para um app de acolhimento em saúde mamária. "
    "Analise APENAS a mensagem da paciente e responda no formato JSON pedido. "
    "sentiment: acolhimento_inicial (saudação/neutro), medo_ansiedade (medo, ansiedade, pânico, preocupação intensa), "
    "duvida_exame (dúvida objetiva sobre sintoma, exame ou laudo), tristeza (tristeza, luto, desesperança), "
    "esperanca_alivio (alívio, gratidão). intensity: 0 (nenhuma) a 10 (sofrimento extremo). "
    "psychological_support_needed: true se houver sofrimento emocional que justifique acolhimento intensivo."
)


class EmotionClassification(BaseModel):
    sentiment: Literal["acolhimento_inicial", "medo_ansiedade", "duvida_exame", "tristeza", "esperanca_alivio"]
    intensity: int = Field(ge=0, le=10)
    psychological_support_needed: bool
    mentions_symptom: bool = False
    mentions_exam: bool = False


async def classify_emotion(text: str) -> Dict[str, Any]:
    """
    Classifica o estado emocional com o LLM (saída estruturada validada por Pydantic).
    Se o LLM estiver indisponível ou devolver algo inválido, usa o classificador por regras.
    Nunca levanta exceção: o atendimento não pode parar por causa da análise emocional.
    """
    rules = analyze_emotional_state_dict(text)
    try:
        from app.ai.llm import generate  # import tardio evita ciclo e permite uso sem LLM

        result = await generate(
            EMOTION_SYSTEM_PROMPT,
            [("user", text)],
            response_schema=EmotionClassification,
            temperature=0.0,
            purpose="emotion",
            max_retries=0,
            alert=False,
        )
        parsed = EmotionClassification.model_validate(json.loads(result.text))
    except Exception as exc:  # noqa: BLE001
        logger.info("Classificação emocional por LLM indisponível, usando regras: %s", exc)
        return rules

    # Rede de segurança: se as regras detectam sofrimento, o LLM não pode desativar o apoio.
    triggered = parsed.psychological_support_needed or rules["psychological_support_triggered"]
    return {
        "sentiment": parsed.sentiment,
        "psychological_support_triggered": triggered,
        "intensity": parsed.intensity,
        "flags": {
            **rules["flags"],
            "has_symptom": rules["flags"]["has_symptom"] or parsed.mentions_symptom,
            "has_exam": rules["flags"]["has_exam"] or parsed.mentions_exam,
        },
        "source": "llm",
    }
