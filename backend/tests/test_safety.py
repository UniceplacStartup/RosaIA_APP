import pytest
from app.ai.safety import (
    assess_urgency,
    validate_reply,
    prepend_notice,
    LEVEL_EMERGENCY,
    LEVEL_PRIORITY,
    LEVEL_NONE,
    SAFE_REPLY_AFTER_VIOLATION
)

def test_urgency_detection_emergency():
    # Mensagem com ideação ou sofrimento crítico
    res = assess_urgency("estou desesperada, sinto que quero morrer com esse nódulo")
    assert res.level == LEVEL_EMERGENCY
    assert "CVV" in res.notice or "SAMU" in res.notice

def test_urgency_detection_breast_bleeding():
    # Sinais de alerta clínicos na mama
    res = assess_urgency("notei um sangramento saindo do meu mamilo ontem")
    assert res.level == LEVEL_PRIORITY
    assert any("sangramento" in r for r in res.reasons)

def test_urgency_detection_lump_features():
    # Nódulo duro e fixo
    res = assess_urgency("senti um caroço duro e fixo na mama que parece estar crescendo")
    assert res.level == LEVEL_PRIORITY
    assert any("característica de alerta" in r for r in res.reasons)

def test_urgency_routine_question():
    # Dúvida rotineira sem urgência
    res = assess_urgency("Olá doutora, com que idade devo fazer mamografia?")
    assert res.level == LEVEL_NONE
    assert res.notice == ""

def test_validate_reply_catches_unauthorized_diagnosis():
    # O modelo nunca pode diagnosticar
    bad_reply = "Com certeza você tem um câncer de mama e deve se preparar."
    violations = validate_reply(bad_reply)
    assert "diagnóstico definitivo" in violations

def test_validate_reply_catches_prescription():
    # O modelo nunca pode prescrever remédios ou dosagens
    bad_reply = "Tome 500 mg de paracetamol para aliviar o inchaço."
    violations = validate_reply(bad_reply)
    assert "prescrição/dose" in violations

def test_validate_reply_accepts_educational_guidance():
    # Orientação educativa segura
    good_reply = (
        "Compreendo sua preocupação, querida. A maioria das alterações mamárias é benigna, "
        "mas é fundamental agendar uma consulta com seu mastologista para avaliação presencial."
    )
    violations = validate_reply(good_reply)
    assert len(violations) == 0

def test_prepend_notice_is_idempotent():
    assessment = assess_urgency("tem sangue saindo da mama")
    reply = "Olá querida, vamos conversar com calma."
    notified = prepend_notice(reply, assessment)
    assert assessment.notice in notified
    # Segunda chamada não duplica
    second = prepend_notice(notified, assessment)
    assert second == notified
