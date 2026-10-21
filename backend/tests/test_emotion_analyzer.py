import pytest
from app.ai.emotion_analyzer import analyze_emotional_state, analyze_emotional_state_dict, classify_emotion

def test_rule_emotion_fear_and_symptom():
    state, triggered, flags = analyze_emotional_state("Estou com muito medo, senti um caroço estranho")
    assert state == "medo_ansiedade"
    assert triggered is True
    assert flags["has_fear"] is True
    assert flags["has_symptom"] is True

def test_rule_emotion_exam_only():
    state, triggered, flags = analyze_emotional_state("O que significa bi-rads 3 no laudo?")
    assert state == "duvida_exame"
    assert triggered is False
    assert flags["has_exam"] is True

def test_rule_emotion_greeting():
    state, triggered, flags = analyze_emotional_state("Olá Doutora Rosa, bom dia!")
    assert state == "acolhimento_inicial"
    assert triggered is False

@pytest.mark.asyncio
async def test_classify_emotion_returns_complete_dict():
    res = await classify_emotion("Estou aflita com o exame de mamografia")
    assert "sentiment" in res
    assert "psychological_support_triggered" in res
    assert "intensity" in res
    assert "flags" in res
    assert res["source"] in ("llm", "rules")
