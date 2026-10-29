import logging
import re
from typing import Any, Dict, Optional, Tuple

from pydantic import BaseModel, Field

from app.ai.prompts import (
    BIRADS_DESCRIPTIONS,
    MANDATORY_MEDICAL_DISCLAIMER,
    SYSTEM_PROMPT_IMAGE_ANALYSIS,
    SYSTEM_PROMPT_REPORT_ANALYSIS,
    clean_rosa_text,
)

logger = logging.getLogger("rosaia.ai.report_interpreter")


class ImageAnalysis(BaseModel):
    """Saída estruturada da análise visual individual de uma imagem enviada à Doutora Rosa."""

    image_kind: str = Field(
        description=(
            "Um de: mamografia, ultrassom_mama, ressonancia_mama, laudo_documento, "
            "outra_imagem_medica, foto_corporal, nao_medica"
        )
    )
    is_breast_imaging: bool = Field(
        description="True se for exame de imagem da mama ou laudo de exame mamário"
    )
    visible_birads: Optional[int] = Field(
        default=None,
        description="Categoria BI-RADS (0 a 6) SOMENTE se estiver escrita literalmente em texto de laudo na imagem; senão null",
    )
    reply: str = Field(
        description="Análise objetiva, detalhada e específica da imagem enviada, em português, sem * nem #"
    )


IMAGE_ANALYSIS_INSTRUCTIONS = (
    "Você recebeu uma IMAGEM enviada pelo usuário para avaliação individual. "
    "Examine atentamente os pixels da imagem anexada e os metadados técnicos/visuais fornecidos abaixo e produza uma "
    "análise OBJETIVA, ESPECÍFICA e ÚNICA para esta imagem:\n"
    "1. Identificação Objetiva da Imagem: informe na primeira frase exatamente qual é o tipo/modalidade da imagem "
    "(ex.: Mamografia Digital DICOM, Ultrassonografia Mamária, Ressonância Magnética, Tomografia, Radiografia de Tórax/Óssea, "
    "Fotografia Clínica, Documento ou Imagem Geral), a região anatômica (ou objeto visualizado), a incidência/projeção "
    "(ex.: CC, MLO, axial, sagital, coronal, AP, PA) e a lateralidade (direita, esquerda, bilateral) quando identificáveis.\n"
    "2. Análise Visual Detalhada e Específica desta Imagem: descreva com precisão e objetividade o que se enxerga nos pixels "
    "desta imagem em particular:\n"
    "   - Se for imagem mamária (mamografia, ultrassom, ressonância): descreva o padrão de densidade/ecogenicidade do parênquima "
    "(predomínio adiposo, fibroglandular esparso, heterogeneamente denso ou denso), a distribuição tecidual pelos quadrantes/regiões, "
    "contorno cutâneo, complexo aréolo-papilar, visualização do músculo peitoral (quando MLO), simetria e eventuais achados visíveis "
    "na imagem (como áreas focais radiopacas/hiperdensas, imagens nodulares circunscritas ou irregulares, áreas hipoecoicas/anecoicas, "
    "assimetrias focais, calcificações puntiformes ou marcadores radiopacos).\n"
    "   - Se for outra imagem médica (raio-X, tomografia, ressonância, ultrassom de outra região): descreva objetivamente as estruturas "
    "anatômicas visíveis, padrões de transparência/atenuação/sinal, contornos ósseos ou parenquimatosos e achados visuais aparentes.\n"
    "   - Se for fotografia ou imagem não médica: descreva objetivamente o conteúdo visual específico presente na imagem.\n"
    "3. Parâmetros Técnicos da Imagem: mencione de forma concisa a qualidade técnica observada (contraste, nitidez, posicionamento, "
    "resolução e parâmetros DICOM relevantes se disponíveis).\n"
    "4. PROIBIDO FALAR GENERICAMENTE DE BI-RADS: NÃO explique a escala BI-RADS (BI-RADS 1, 2, 3, 4, 5) ao analisar uma imagem! "
    "Só mencione BI-RADS se a imagem for uma foto de um documento/laudo em texto onde a categoria BI-RADS esteja literalmente escrita.\n"
    "5. Formatação e Ética: NÃO use asteriscos (*) nem hashtags (#). Oculte qualquer dado pessoal visível na imagem. "
    "Finalize de forma acolhedora e objetiva perguntando se a pessoa quer tirar dúvidas sobre algum detalhe específico observado nesta imagem."
)


def build_specific_image_analysis_fallback(
    original_filename: str,
    extra_context: str = "",
    technical_meta: Optional[Dict[str, Any]] = None,
) -> ImageAnalysis:
    """
    Constrói uma análise técnica e visual objetiva e específica baseada nos metadados DICOM reais
    e nas métricas quantitativas extraídas dos pixels da imagem submetida, sem discurso genérico de BI-RADS.
    """
    meta = technical_meta or {}
    is_dicom = bool(meta.get("is_dicom")) or original_filename.lower().endswith((".dcm", ".dicom", ".ima"))
    modality_code = (meta.get("modality_code") or "").upper()
    modality_label = meta.get("modality") or ("Exame de Imagem DICOM" if is_dicom else "Imagem Digital")
    body_part = meta.get("body_part") or ""
    laterality = meta.get("laterality") or ""
    view_pos = meta.get("view_position") or ""
    study_desc = meta.get("study_description") or ""
    series_desc = meta.get("series_description") or ""
    protocol_name = meta.get("protocol_name") or ""
    vis = meta.get("visual_stats") or {}
    file_hash = meta.get("file_hash") or ""

    # Determina se a imagem é mamária com base nos metadados reais ou nome do arquivo
    combined_hint = f"{modality_code} {body_part} {study_desc} {series_desc} {original_filename}".lower()
    is_breast = (
        modality_code == "MG"
        or any(k in combined_hint for k in ("mama", "breast", "mamograf", "cc", "mlo", "mast"))
        or (is_dicom and not body_part and modality_code in ("", "MG", "US", "MR"))
    )

    if modality_code == "MG" or "mamograf" in combined_hint:
        image_kind = "mamografia"
    elif modality_code == "US" and is_breast:
        image_kind = "ultrassom_mama"
    elif modality_code == "MR" and is_breast:
        image_kind = "ressonancia_mama"
    elif is_dicom or modality_code in ("CT", "MR", "CR", "DX", "US", "XA", "NM", "PT"):
        image_kind = "outra_imagem_medica"
    else:
        image_kind = "mamografia" if is_breast else "outra_imagem_medica"

    header_parts = [f"Modalidade identificada: {modality_label}"]
    if body_part:
        header_parts.append(f"Região anatômica: {body_part}")
    elif is_breast:
        header_parts.append("Região anatômica: Tecido mamário")
    if laterality:
        header_parts.append(f"Lateralidade: {laterality}")
    if view_pos:
        header_parts.append(f"Incidência/Projeção: {view_pos}")

    desc_items = [p for p in (study_desc, series_desc, protocol_name) if p]

    lines = [
        f"Realizei a avaliação técnica e visual individual do arquivo {original_filename}"
        + (f" (registro de imagem #{file_hash})." if file_hash else "."),
        "",
        "• Identificação Técnica da Imagem:",
        "  - " + " | ".join(header_parts) + ".",
    ]
    if desc_items:
        lines.append(f"  - Série / Protocolo do exame: {' — '.join(desc_items)}.")

    rows = meta.get("rows") or vis.get("height")
    cols = meta.get("columns") or vis.get("width")
    bits = meta.get("bits_stored")
    photometric = meta.get("photometric")
    kvp = meta.get("kvp")
    exposure = meta.get("exposure")
    slice_thickness = meta.get("slice_thickness")
    pixel_spacing = meta.get("pixel_spacing")

    tech_specs = []
    if cols and rows:
        tech_specs.append(f"matriz de {cols}x{rows} pixels")
    if bits:
        tech_specs.append(f"profundidade de {bits} bits")
    if photometric:
        tech_specs.append(f"fotometria {photometric}")
    if pixel_spacing:
        tech_specs.append(f"espaçamento de pixel {pixel_spacing} mm")
    if slice_thickness:
        tech_specs.append(f"espessura de corte {slice_thickness} mm")
    if kvp:
        tech_specs.append(f"tensão de {kvp} kVp")
    if exposure:
        tech_specs.append(f"exposição de {exposure}")
    if tech_specs:
        lines.append(f"  - Parâmetros de aquisição registrados: {', '.join(tech_specs)}.")

    if vis:
        q_means = vis.get("quadrant_means") or {}
        density_pattern = vis.get("density_pattern", "distribuição intermediária")
        rel_dense = vis.get("relative_dense_ratio", 0.0)
        soft_pct = vis.get("soft_tissue_pct", 0.0)
        dense_pct = vis.get("dense_tissue_pct", 0.0)
        hyper_pct = vis.get("hyperdense_foci_pct", 0.0)
        dom_q = vis.get("dominant_quadrant", "central")
        focal_q = vis.get("focal_quadrant", "central")
        mean_val = vis.get("mean_intensity", 0.0)
        std_val = vis.get("std_contrast", 0.0)
        lr_diff = vis.get("left_right_diff", 0.0)

        lines.extend([
            "",
            "• Análise Visual e Morfológica Específica da Imagem:",
            (
                f"  - Padrão de densidade e atenuação tecidual: observa-se {density_pattern}, "
                f"com {rel_dense}% da área útil apresentando maior radiopacidade/atenuação, "
                f"{soft_pct}% de intensidade intermediária (parênquima/partes moles de menor densidade) "
                f"e {dense_pct}% de feixes densos."
            ),
            (
                f"  - Distribuição topográfica nos quadrantes: a maior concentração de brilho/densidade "
                f"encontra-se no quadrante {dom_q} (intensidades médias: "
                f"Sup. Esq. {q_means.get('superior_esquerdo', 0)}, "
                f"Sup. Dir. {q_means.get('superior_direito', 0)}, "
                f"Inf. Esq. {q_means.get('inferior_esquerdo', 0)}, "
                f"Inf. Dir. {q_means.get('inferior_direito', 0)} e região central {vis.get('center_mean', 0)} em escala 0–255)."
            ),
        ])

        if hyper_pct >= 3.0:
            lines.append(
                f"  - Áreas hiperintensas / radiopacas: identificam-se {hyper_pct}% de pixels de alta intensidade "
                f"(>210/255), com maior concentração no quadrante {focal_q}, compatíveis com estruturas de maior "
                f"atenuação radiológica, confluência parenquimatosa ou marcadores radiopacos da incidência."
            )
        elif hyper_pct >= 0.4:
            lines.append(
                f"  - Focos de alta atenuação: presença discreta ({hyper_pct}%) de pontos de maior brilho no "
                f"quadrante {focal_q}, sem extensas áreas de hiperdensidade confluente."
            )
        else:
            lines.append(
                "  - Focos hiperintensos: não se observam aglomerados expressivos de hiperintensidade extrema (>210/255) na matriz analisada."
            )

        symmetry_desc = (
            "distribuição horizontal equilibrada entre as metades da imagem"
            if lr_diff < 18.0
            else f"assimetria de distribuição luminosa entre os lados esquerdo e direito da imagem (diferença média de {lr_diff} pontos, típica da projeção anatômica unilateral)"
        )
        lines.append(
            f"  - Contraste e simetria da matriz: luminância global média de {mean_val}/255 com desvio-padrão de contraste de {std_val}, "
            f"apresentando {symmetry_desc}."
        )

    lines.extend([
        "",
        "• Orientação Objetiva:",
        "  - Esta leitura descreve especificamente os parâmetros visuais e técnicos extraídos desta imagem submetida.",
        "  - Para correlação clínica completa com seu histórico e exame físico, apresente a imagem ao médico responsável. "
        "Quer me perguntar sobre algum detalhe específico observado nesta imagem?",
    ])

    return ImageAnalysis(
        image_kind=image_kind,
        is_breast_imaging=is_breast,
        visible_birads=None,
        reply=clean_rosa_text("\n".join(lines)),
    )


async def analyze_medical_image(
    image: Optional[Tuple[bytes, str]],
    original_filename: str,
    extra_context: str = "",
    technical_meta: Optional[Dict[str, Any]] = None,
) -> ImageAnalysis:
    """
    Envia a imagem (e seu contexto técnico/visual extraído) ao Gemini Vision e retorna a análise
    estruturada específica para aquela imagem. Se o modelo em nuvem não estiver disponível,
    utiliza a análise técnica e quantitativa específica da própria imagem (nunca texto genérico).
    """
    from app.ai.llm import generate

    prompt = f"Arquivo de imagem submetido: {original_filename}.\n{IMAGE_ANALYSIS_INSTRUCTIONS}"
    if extra_context:
        prompt += f"\n\nDados técnicos e métricas visuais extraídos desta imagem específica:\n{extra_context}"

    if image is not None:
        # 1ª tentativa: saída estruturada JSON com visão multimodal
        try:
            result = await generate(
                system_instruction=SYSTEM_PROMPT_IMAGE_ANALYSIS,
                turns=[("user", prompt)],
                response_schema=ImageAnalysis,
                temperature=0.25,
                purpose="image_analysis",
                images=[image],
            )
            analysis = ImageAnalysis.model_validate_json(result.text)
            analysis.reply = clean_rosa_text(analysis.reply)
            if analysis.visible_birads is not None and not 0 <= analysis.visible_birads <= 6:
                analysis.visible_birads = None
            if analysis.reply:
                return analysis
        except Exception as exc:  # noqa: BLE001
            logger.warning("Tentativa estruturada de análise visual falhou (%s), tentando modo texto direto.", exc)

        # 2ª tentativa: visão multimodal em texto livre (caso response_schema falhe no modelo alternativo)
        try:
            result = await generate(
                system_instruction=SYSTEM_PROMPT_IMAGE_ANALYSIS,
                turns=[("user", prompt)],
                response_schema=None,
                temperature=0.25,
                purpose="image_analysis_text",
                images=[image],
            )
            clean_reply = clean_rosa_text(result.text)
            if clean_reply:
                fallback_info = build_specific_image_analysis_fallback(
                    original_filename, extra_context, technical_meta
                )
                return ImageAnalysis(
                    image_kind=fallback_info.image_kind,
                    is_breast_imaging=fallback_info.is_breast_imaging,
                    visible_birads=None,
                    reply=clean_reply,
                )
        except Exception as exc:  # noqa: BLE001
            logger.error("Erro na análise visual multimodal da imagem %s: %s", original_filename, exc)

    # Contingência determinística específica: usa as tags DICOM reais e a estatística de pixels desta imagem
    return build_specific_image_analysis_fallback(original_filename, extra_context, technical_meta)


def extract_birads_classification(text: str) -> Optional[int]:
    """
    Identifica menções explícitas à classificação BI-RADS (categorias 0 a 6) no texto de um laudo.
    """
    patterns = [
        r"bi[-\s]?rads[:\s\-–—]+(?:categoria\s*)?([0-6])\b",
        r"categoria\s+bi[-\s]?rads[:\s\-–—]+([0-6])\b",
        r"\bbirads[:\s\-–—]*([0-6])\b",
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
    Detecta achados radiológicos comuns em laudos textuais.
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
        "circunscrito": bool(re.search(r"\bcircunscrit[ao]", text_lower)),
    }


async def generate_educational_report_analysis(
    sanitized_text: str,
    original_filename: str,
) -> Dict[str, Any]:
    """
    Realiza a interpretação acolhedora e pedagógica de um laudo médico em texto/PDF/DOCX.
    Retorna exclusivamente informações descritivas do laudo, sem dados pessoais.
    Sem asteriscos (*) ou hashtags (#).
    """
    birads_cat = extract_birads_classification(sanitized_text)
    findings = extract_medical_findings(sanitized_text)

    birads_info = (
        BIRADS_DESCRIPTIONS.get(birads_cat, "")
        if birads_cat is not None
        else "Sem categoria BI-RADS explícita no texto."
    )

    summary_text = ""

    prompt = (
        f"Analise o seguinte documento/laudo desidentificado ({original_filename}):\n\n"
        f"--- CONTEÚDO DESIDENTIFICADO ---\n{sanitized_text}\n--- FIM DO CONTEÚDO ---\n\n"
        f"Instruções:\n"
        f"1. Analise objetivamente e especificamente os achados descritos neste documento, sem expor nenhum dado pessoal.\n"
        f"2. Forneça uma explicação didática, clara e acolhedora dos termos técnicos presentes no texto.\n"
        f"3. Só mencione BI-RADS se ele constar explicitamente no texto do documento.\n"
        f"4. Convide a pessoa a fazer perguntas sobre os pontos específicos deste documento.\n"
        f"5. NUNCA use asteriscos (*) ou hashtags (#)."
    )

    try:
        from app.ai.llm import generate

        result = await generate(
            system_instruction=SYSTEM_PROMPT_REPORT_ANALYSIS,
            turns=[("user", prompt)],
            temperature=0.3,
            purpose="report_analysis",
        )
        summary_text = result.text.strip()
    except Exception as exc:
        logger.error("Erro ao invocar Gemini para análise de laudo: %s", exc)

    if not summary_text:
        active_findings = [k for k, v in findings.items() if v]
        findings_line = (
            f"Termos identificados no documento: {', '.join(active_findings)}."
            if active_findings
            else f"Resumo do texto extraído: {sanitized_text[:350]}"
        )
        birads_section = f"\nClassificação mencionada no texto: {birads_info}\n" if birads_cat is not None else "\n"
        summary_text = (
            f"Analisei o conteúdo descritivo do documento {original_filename}.\n"
            f"{birads_section}\n"
            f"{findings_line}\n\n"
            f"Fique à vontade para me perguntar sobre qualquer termo específico deste documento para que eu te explique com clareza."
        )

    if birads_cat == 0:
        next_steps = "Agende a consulta com seu médico para solicitar imagens complementares ou comparar com exames anteriores."
    elif birads_cat in (1, 2):
        next_steps = "Exame dentro dos padrões benignos. Mantenha seus exames preventivos de rotina no intervalo recomendado pelo médico."
    elif birads_cat == 3:
        next_steps = "Achado provavelmente benigno. O protocolo habitual é realizar controle comparativo em 6 meses."
    elif birads_cat in (4, 5):
        next_steps = "Leve este resultado ao médico para avaliação clínica e definição de investigação complementar."
    elif birads_cat == 6:
        next_steps = "Siga o plano terapêutico definido pela sua equipe médica."
    else:
        next_steps = "Apresente o documento integral ao seu médico na consulta para correlação clínica individualizada."

    summary_text = clean_rosa_text(summary_text)

    clean_disclaimer = clean_rosa_text(MANDATORY_MEDICAL_DISCLAIMER)
    if clean_disclaimer not in summary_text:
        summary_text += f"\n\n{clean_disclaimer}"

    return {
        "birads_category": birads_cat,
        "birads_meaning": birads_info,
        "findings": findings,
        "educational_summary": summary_text,
        "recommended_next_steps": next_steps,
        "disclaimer": clean_disclaimer,
    }
