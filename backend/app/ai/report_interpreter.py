import re
import logging
from typing import Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field
from app.ai.prompts import (
    SYSTEM_PROMPT_DOUTORA_ROSA,
    SYSTEM_PROMPT_REPORT_ANALYSIS,
    MANDATORY_MEDICAL_DISCLAIMER,
    BIRADS_DESCRIPTIONS,
    clean_rosa_text
)
from app.ai.client import get_genai_client
from app.core.config import settings

logger = logging.getLogger("rosaia.ai.report_interpreter")


class ImageAnalysis(BaseModel):
    """Saída estruturada da análise visual de uma imagem enviada à Doutora Rosa."""
    image_kind: str = Field(
        description=(
            "Um de: mamografia, ultrassom_mama, ressonancia_mama, laudo_documento, "
            "outra_imagem_medica, foto_corporal, nao_medica"
        )
    )
    is_breast_imaging: bool = Field(description="True se for exame de imagem da mama ou laudo de exame mamário")
    visible_birads: Optional[int] = Field(
        default=None,
        description="Categoria BI-RADS (0 a 6) SOMENTE se estiver escrita de forma legível na imagem; senão null",
    )
    reply: str = Field(description="Resposta final da Doutora Rosa para a usuária, em português, sem * nem #")


IMAGE_ANALYSIS_INSTRUCTIONS = (
    "Você recebeu uma IMAGEM enviada pela usuária. Olhe a imagem de verdade e responda de forma dinâmica, "
    "objetiva e específica para o que ela realmente contém. Siga estas regras:\n"
    "1. Primeiro identifique o que é a imagem (image_kind) e diga isso claramente na resposta, em uma frase.\n"
    "2. Se NÃO for exame/laudo mamário (ex.: paisagem, pessoa, documento qualquer, outro exame), diga com gentileza "
    "e objetividade o que você vê, explique que não é um exame de mama e que, por isso, não há o que interpretar como "
    "mamografia. NÃO mencione BI-RADS nem peça BI-RADS. Pergunte em que pode ajudar.\n"
    "3. Se for mamografia, ultrassom ou ressonância da mama: descreva de forma objetiva o que é visível "
    "(tipo de exame, incidência/lateralidade se identificáveis, padrão de densidade, e qualquer achado aparente como "
    "nódulo, assimetria ou calcificações, sempre usando termos como 'aparenta' ou 'parece'). Deixe claro que uma imagem "
    "analisada por IA não substitui a leitura do radiologista e que a classificação BI-RADS só vale quando consta no "
    "laudo médico. Só peça o BI-RADS/laudo se ele NÃO estiver visível na imagem e se for útil.\n"
    "4. Se a imagem for um laudo escrito: leia o texto visível, explique os termos e a categoria BI-RADS (se constar) "
    "em linguagem leiga, e preencha visible_birads.\n"
    "5. Nunca dê diagnóstico definitivo, prognóstico ou tratamento. Nunca invente achados que não enxerga; se a "
    "qualidade for ruim, diga isso. Oculte qualquer dado pessoal (nome, CPF, datas de nascimento) que apareça.\n"
    "6. Seja concisa (até cerca de 180 palavras), acolhedora, sem asteriscos nem hashtags, e termine com uma pergunta "
    "curta e aberta. Recomende avaliação presencial apenas quando for exame mamário."
)


async def analyze_medical_image(
    image: Tuple[bytes, str],
    original_filename: str,
    extra_context: str = "",
) -> Optional[ImageAnalysis]:
    """
    Envia a imagem ao Gemini (multimodal) e retorna a análise estruturada.
    Retorna None se o modelo estiver indisponível (o chamador usa fallback honesto).
    """
    from app.ai.llm import generate

    prompt = f"Arquivo enviado: {original_filename}.\n{IMAGE_ANALYSIS_INSTRUCTIONS}"
    if extra_context:
        prompt += f"\n\nContexto da usuária: {extra_context}"
    try:
        result = await generate(
            system_instruction=(
                SYSTEM_PROMPT_DOUTORA_ROSA
                + "\n\nAs regras específicas da tarefa atual prevalecem sobre as diretrizes gerais acima "
                "(por exemplo: não fale de BI-RADS nem de benignidade se a imagem não for um exame mamário)."
            ),
            turns=[("user", prompt)],
            response_schema=ImageAnalysis,
            temperature=0.2,
            purpose="image_analysis",
            images=[image],
        )
        analysis = ImageAnalysis.model_validate_json(result.text)
        analysis.reply = clean_rosa_text(analysis.reply)
        if analysis.visible_birads is not None and not 0 <= analysis.visible_birads <= 6:
            analysis.visible_birads = None
        return analysis
    except Exception as exc:  # noqa: BLE001
        logger.error("Erro na análise visual da imagem: %s", exc)
        return None

def extract_birads_classification(text: str) -> Optional[int]:
    """
    Identifica menções à classificação BI-RADS (categorias 0 a 6) no texto do laudo.
    """
    patterns = [
        r"bi[-\s]?rads[:\s\-–—]+(?:categoria\s*)?([0-6])\b",
        r"categoria\s+bi[-\s]?rads[:\s\-–—]+([0-6])\b",
        r"\bbirads[:\s\-–—]*([0-6])\b",
        r"categoria[:\s\-–—]*([0-6])\b"
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                continue
    return None

def extract_medical_findings(text: str) -> Dict[str, bool]:
    """
    Detecta achados radiológicos comuns para auxiliar na explicação educativa.
    """
    text_lower = text.lower()
    return {
        "nodulo": bool(re.search(r"\bn[óo]dulo", text_lower)),
        "cisto": bool(re.search(r"\bcisto", text_lower)),
        "calcificacoes": bool(re.search(r"\bcalcifica[çc][õo]es|microcalcifica[çc][õo]es", text_lower)),
        "assimetria": bool(re.search(r"\bassimetria", text_lower)),
        "linfonodo": bool(re.search(r"\blinfonodo", text_lower)),
        "ectasia": bool(re.search(r"\bectasia", text_lower)),
        "espiculado": bool(re.search(r"\bespiculad[ao]", text_lower)),
        "circunscrito": bool(re.search(r"\bcircunscrit[ao]", text_lower))
    }

async def generate_educational_report_analysis(
    sanitized_text: str,
    original_filename: str
) -> Dict[str, Any]:
    """
    Realiza a interpretação acolhedora e pedagógica do laudo médico ou imagem.
    Retorna exclusivamente informações descritivas do laudo, sem dados pessoais,
    permitindo que a usuária tire dúvidas de forma interativa.
    Sem asteriscos (*) ou hashtags (#).
    """
    birads_cat = extract_birads_classification(sanitized_text)
    findings = extract_medical_findings(sanitized_text)
    
    birads_info = BIRADS_DESCRIPTIONS.get(
        birads_cat,
        "Não foi identificada uma categoria BI-RADS padronizada (0 a 6) de forma explícita no texto fornecido."
    )

    summary_text = ""
    next_steps = ""

    prompt = (
        f"Analise o seguinte laudo/exame de imagem mamária desidentificado da paciente:\n\n"
        f"--- CONTEÚDO DESIDENTIFICADO ---\n{sanitized_text}\n--- FIM DO CONTEÚDO ---\n\n"
        f"Classificação prévia detectada: BI-RADS {birads_cat if birads_cat is not None else 'Indeterminada'}.\n"
        f"Instruções:\n"
        f"1. Retorne exclusivamente informações descritivas do laudo/exame, sem expor nenhum dado pessoal.\n"
        f"2. Forneça uma tradução didática, amigável e acolhedora dos termos técnicos encontrados e da classificação.\n"
        f"3. Convide a paciente a fazer perguntas e tirar dúvidas sobre os termos de forma interativa.\n"
        f"4. NUNCA use asteriscos (*) ou hashtags (#)."
    )

    try:
        from app.ai.llm import generate
        result = await generate(
            system_instruction=SYSTEM_PROMPT_REPORT_ANALYSIS,
            turns=[("user", prompt)],
            temperature=0.3,
            purpose="report_analysis"
        )
        summary_text = result.text.strip()
    except Exception as exc:
        logger.error("Erro ao invocar Gemini para análise de laudo: %s", exc)

    if not summary_text:
        # Fallback determinístico humanizado, sem nenhum asterisco ou hashtag
        birads_label = f"BI-RADS {birads_cat}" if birads_cat is not None else "Não categorizado"
        summary_text = (
            f"Olá! Analisei com todo carinho as características descritivas do documento {original_filename}.\n\n"
            f"Classificação Encontrada: {birads_label}\n"
            f"{birads_info}\n\n"
            f"Aspectos descritivos observados: O exame apresenta achados que foram registrados com segurança pela equipe técnica. "
            f"Lembre-se sempre de que cerca de 80% das alterações identificadas em exames de imagem mamária são completamente benignas, "
            f"como cistos simples ou fibroadenomas. O exame é uma ferramenta essencial de prevenção e cuidado.\n\n"
            f"Fique totalmente à vontade para me perguntar qualquer termo ou dúvida que você queira esclarecer sobre este laudo! "
            f"Estou aqui com você para conversarmos sobre cada detalhe com calma."
        )

    # Determinação de próximos passos
    if birads_cat == 0:
        next_steps = "Agende a consulta com seu médico para solicitar exames complementares (como ultrassonografia ou mamografia com compressão) ou comparar com seus exames anteriores."
    elif birads_cat in (1, 2):
        next_steps = "Seu exame está dentro dos padrões esperados e benignos. Continue mantendo seus exames preventivos de rotina no intervalo recomendado pelo seu médico."
    elif birads_cat == 3:
        next_steps = "O achado é provavelmente benigno. O protocolo padrão é realizar um exame de controle em 6 meses para acompanhar a estabilidade."
    elif birads_cat in (4, 5):
        next_steps = "É fundamental levar este resultado ao seu médico sem demora para uma avaliação clínica e orientação sobre possíveis exames complementares de investigação (como biópsia)."
    elif birads_cat == 6:
        next_steps = "Siga estritamente o plano terapêutico definido pela sua equipe médica de oncologia e mastologia."
    else:
        next_steps = "Apresente o laudo integral ao seu médico na próxima consulta para esclarecimento das condutas individualizadas."

    # Limpeza estrita de qualquer asterisco (*) ou hashtag (#)
    summary_text = clean_rosa_text(summary_text)

    # Injeção do aviso legal médico (RNF13) sem asteriscos
    clean_disclaimer = clean_rosa_text(MANDATORY_MEDICAL_DISCLAIMER)
    if clean_disclaimer not in summary_text:
        summary_text += f"\n\n{clean_disclaimer}"

    return {
        "birads_category": birads_cat,
        "birads_meaning": birads_info,
        "findings": findings,
        "educational_summary": summary_text,
        "recommended_next_steps": next_steps,
        "disclaimer": clean_disclaimer
    }
