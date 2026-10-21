import pytest
from app.ai import monitoring
from app.ai.llm import generate, LLMUnavailableError

def test_monitoring_counter_increments():
    before = monitoring.snapshot().get("test_metric", 0)
    monitoring.incr("test_metric", 2)
    after = monitoring.snapshot().get("test_metric", 0)
    assert after == before + 2

@pytest.mark.asyncio
async def test_llm_handles_empty_key(monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    with pytest.raises(LLMUnavailableError):
        await generate(
            system_instruction="Teste",
            turns=[("user", "Oi")],
            purpose="test",
            max_retries=0,
            alert=False
        )
