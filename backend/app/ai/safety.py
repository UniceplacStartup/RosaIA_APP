"""
Guardrails de segurança clínica (determinísticos, independentes do LLM).

Detectam urgências e sinais de alerta na mensagem da usuária e validam a resposta
gerada pelo modelo antes de ela chegar à paciente.
"""
import re
import unicodedata
from dataclasses import dataclass, field
from typing import List

LEVEL_NONE = "none"
LEVEL_PRIORITY = "priority"
LEVEL_EMERGENCY = "emergency"

NOTICE_EMERGENCY_MEDICAL = (
    "Atenção: o que você descreveu pode precisar de avaliação médica urgente. "
    "Procure agora uma UPA/pronto-atendimento ou ligue para o SAMU (192). "
    "Não espere para buscar ajuda presencial."
)
NOTICE_EMERGENCY_MENTAL = (
    "Sua vida importa muito. Se você está pensando em se machucar ou desistir de viver, "
    "ligue agora para o CVV (188) — gratuito, 24 horas — ou para o SAMU (192), "
    "ou vá ao pronto-atendimento mais próximo. Você não precisa passar por isso sozinha."
)
NOTICE_PRIORITY = (
    "Importante: esse sinal merece avaliação médica prioritária. Agende uma consulta "
    "com mastologista ou procure sua UBS o quanto antes (idealmente nos próximos dias). "
    "Isso não significa que seja câncer — a maioria das alterações é benigna —, mas só um "
    "exame presencial consegue esclarecer com segurança."
)

SAFE_REPLY_AFTER_VIOLATION = (
    "Querida, eu consigo te orientar de forma educativa, mas não posso indicar diagnósticos, "
    "medicamentos ou doses. O melhor passo é conversar com seu médico(a) mastologista ou "
    "ginecologista, ou procurar sua Unidade Básica de Saúde, levando seus exames. "
    "Se quiser, posso te explicar termos de um laudo ou te ajudar a preparar perguntas para a consulta. 🌸"
)


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


_SUICIDE = re.compile(
    r"\b(quero morrer|vou me matar|me matar|suicid\w*|acabar com (a )?(minha )?vida|"
    r"nao quero mais viver|tirar (a )?minha vida|pensando em morrer)\b"
)
_ACUTE = re.compile(
    r"\b(falta de ar|dificuldade (para|de) respirar|desmai\w*|desmaiei|dor forte no peito|"
    r"febre alta|pus|abscesso|sangramento (intenso|forte|muito))\b"
)
_BREAST_WORDS = r"(mama|mamas|seio|seios|peito|peitos|mamilo|mamilos|papila|axila)"
_BLOOD = re.compile(r"\b(sangr\w*|sangue)\b")
_LUMP = re.compile(r"\b(caroco|carocos|nodulo|nodulos|bolinha|bolinhas|massa|ingua|inguas)\b")
_LUMP_CONCERN = re.compile(
    r"\b(cresc\w*|aument\w*|duro|dura|enrijec\w*|endurec\w*|fixo|fixa|nao doi|"
    r"casca de laranja|retrac\w*|afund\w*|mamilo invertido|ferida|ulcer\w*|"
    r"secrecao (com )?(sangue|sanguinolenta)|ingua\w* na axila|caroco na axila)\b"
)
_BIRADS_HIGH = re.compile(r"\bbi[- ]?rads\s*[:\-]?\s*(4|5|6)\b|\bbirads\s*(4|5|6)\b")

_SKIN_DIMPLING = re.compile(r"casca de laranja")


@dataclass
class SafetyAssessment:
    level: str = LEVEL_NONE
    reasons: List[str] = field(default_factory=list)
    notice: str = ""

    @property
    def prompt_directive(self) -> str:
        if self.level == LEVEL_EMERGENCY:
            return (
                "[ALERTA DE SEGURANÇA – URGÊNCIA] A mensagem contém sinal de urgência "
                f"({', '.join(self.reasons)}). Acolha em 1–2 frases e deixe claro que ela deve "
                "buscar atendimento presencial imediato (SAMU 192 / pronto-atendimento; CVV 188 "
                "em caso de sofrimento emocional grave). Não minimize, não faça diagnóstico."
            )
        if self.level == LEVEL_PRIORITY:
            return (
                "[ALERTA DE SEGURANÇA – PRIORIDADE] A mensagem contém sinal de alerta "
                f"({', '.join(self.reasons)}). Acolha, reforce que é necessária avaliação médica "
                "prioritária (mastologista/UBS nos próximos dias) sem causar pânico e sem diagnosticar."
            )
        return ""


def assess_urgency(text: str) -> SafetyAssessment:
    """Classifica a urgência da mensagem da usuária por regras."""
    t = _normalize(text)

    if _SUICIDE.search(t):
        return SafetyAssessment(LEVEL_EMERGENCY, ["sofrimento emocional grave"], NOTICE_EMERGENCY_MENTAL)

    if _ACUTE.search(t):
        return SafetyAssessment(LEVEL_EMERGENCY, ["sintoma agudo"], NOTICE_EMERGENCY_MEDICAL)

    reasons: List[str] = []
    has_breast = re.search(_BREAST_WORDS, t) is not None
    if _BLOOD.search(t) and (has_breast or _LUMP.search(t)):
        reasons.append("sangramento/secreção com sangue na mama")
    if _LUMP.search(t) and _LUMP_CONCERN.search(t):
        reasons.append("nódulo com característica de alerta")
    if _SKIN_DIMPLING.search(t):
        reasons.append("alteração da pele da mama")
    if _BIRADS_HIGH.search(t):
        reasons.append("BI-RADS 4, 5 ou 6 mencionado")

    if reasons:
        return SafetyAssessment(LEVEL_PRIORITY, sorted(set(reasons)), NOTICE_PRIORITY)
    return SafetyAssessment()


_FORBIDDEN_REPLY = [
    (re.compile(r"\bvoce (tem|esta com|possui) (um )?(cancer|tumor maligno|neoplasia)\b"), "diagnóstico definitivo"),
    (re.compile(r"\b(e|trata-se de|com certeza e) (um )?cancer\b"), "diagnóstico definitivo"),
    (re.compile(r"\bnao (precisa|ha necessidade de) (ir|procurar|consultar)\b.*\bmedic"), "desencorajar atendimento médico"),
    (re.compile(r"\b(tome|use|ingira|aplique)\b[^.\n]{0,40}\b\d+\s?(mg|mcg|g|ml|comprimidos?|gotas)\b"), "prescrição/dose"),
    (re.compile(r"\b(suspenda|pare de tomar|interrompa)\b[^.\n]{0,40}\b(medicamento|remedio|tratamento|quimioterapia)\b"), "orientação de tratamento"),
]


def validate_reply(reply: str) -> List[str]:
    """Retorna a lista de violações de segurança encontradas na resposta do modelo."""
    t = _normalize(reply)
    return sorted({label for pattern, label in _FORBIDDEN_REPLY if pattern.search(t)})


def prepend_notice(reply: str, assessment: SafetyAssessment) -> str:
    """Garante o aviso de urgência no topo da resposta (idempotente)."""
    if assessment.level == LEVEL_NONE or not assessment.notice:
        return reply
    if assessment.notice in reply:
        return reply
    return f"{assessment.notice}\n\n{reply}"
