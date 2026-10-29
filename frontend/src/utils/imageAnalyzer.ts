/**
 * Analisador local de imagens médicas (DICOM .dcm e convencionais JPG/PNG/WEBP/BMP)
 * no navegador. Extrai tags DICOM binárias reais, renderiza os pixels em Canvas
 * para envio multimodal (Vision) e calcula estatísticas quantitativas por quadrante
 * para garantir que cada imagem receba uma análise única, objetiva e específica.
 */

export interface LocalImageAnalysisResult {
  isImageOrDicom: boolean;
  isDicom: boolean;
  filename: string;
  fileHashShort: string;
  jpegBase64?: string;
  jpegMimeType?: string;
  technicalSummary: string;
  specificObjectiveReply: string;
}

const MODALITY_LABELS: Record<string, string> = {
  MG: 'Mamografia Digital (MG)',
  US: 'Ultrassonografia (US)',
  MR: 'Ressonância Magnética (MR)',
  CT: 'Tomografia Computadorizada (CT)',
  CR: 'Radiografia Computadorizada (CR)',
  DX: 'Radiografia Digital (DX)',
  RG: 'Radiografia Convencional (RG)',
  NM: 'Medicina Nuclear (NM)',
  PT: 'PET / Tomografia por Emissão de Pósitrons (PT)',
  XA: 'Angiografia Digital (XA)',
  OT: 'Outra Modalidade Médica (OT)',
  SC: 'Captura Secundária Digital (SC)',
};

const VIEW_LABELS: Record<string, string> = {
  CC: 'Craniocaudal (CC)',
  MLO: 'Médio-Lateral Oblíqua (MLO)',
  ML: 'Médio-Lateral (ML)',
  LM: 'Látero-Medial (LM)',
  AP: 'Ântero-Posterior (AP)',
  PA: 'Póstero-Anterior (PA)',
  LAT: 'Perfil / Lateral (LAT)',
};

const LATERALITY_LABELS: Record<string, string> = {
  R: 'Direita (R)',
  L: 'Esquerda (L)',
  B: 'Bilateral (B)',
};

function computeSimpleHash(bytes: Uint8Array): string {
  let h1 = 0xdeadbeef ^ bytes.length;
  let h2 = 0x41c6ce57 ^ bytes.length;
  const step = Math.max(1, Math.floor(bytes.length / 16384));
  for (let i = 0; i < bytes.length; i += step) {
    const ch = bytes[i] ?? 0;
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')).slice(0, 10);
}

interface ParsedDicomTags {
  modality?: string;
  bodyPart?: string;
  laterality?: string;
  viewPosition?: string;
  studyDescription?: string;
  seriesDescription?: string;
  protocolName?: string;
  manufacturer?: string;
  rows?: number;
  columns?: number;
  bitsAllocated?: number;
  bitsStored?: number;
  photometric?: string;
  kvp?: string;
  sliceThickness?: string;
  pixelDataOffset?: number;
  pixelDataLength?: number;
}

const LONG_VR_SET = new Set(['OB', 'OD', 'OF', 'OL', 'OW', 'SQ', 'UC', 'UN', 'UR', 'UT']);

/** Lê tags DICOM diretamente do buffer binário (Explicit ou Implicit VR Little Endian). */
function parseDicomBinaryTags(bytes: Uint8Array): ParsedDicomTags {
  const tags: ParsedDicomTags = {};
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const hasDicm =
    bytes.length >= 132 &&
    bytes[128] === 0x44 &&
    bytes[129] === 0x49 &&
    bytes[130] === 0x43 &&
    bytes[131] === 0x4d;

  let offset = hasDicm ? 132 : 0;
  const maxScan = Math.min(bytes.length, 512 * 1024);
  const decoder = new TextDecoder('latin1');

  const readCleanAscii = (start: number, len: number): string => {
    if (start < 0 || len <= 0 || start + len > bytes.length) return '';
    return decoder
      .decode(bytes.subarray(start, start + len))
      .replace(/[\0\r\n\t]+/g, ' ')
      .trim();
  };

  let safetyCount = 0;
  while (offset + 8 <= maxScan && safetyCount < 4000) {
    safetyCount += 1;
    const group = view.getUint16(offset, true);
    const element = view.getUint16(offset + 2, true);

    if (group === 0xfffe) {
      const itemLen = view.getUint32(offset + 4, true);
      offset += 8 + (itemLen !== 0xffffffff && itemLen > 0 && offset + 8 + itemLen <= bytes.length ? itemLen : 0);
      continue;
    }

    const vr0 = bytes[offset + 4] ?? 0;
    const vr1 = bytes[offset + 5] ?? 0;
    const isExplicitVr = vr0 >= 65 && vr0 <= 90 && vr1 >= 65 && vr1 <= 90;

    let vr = '';
    let valueLength = 0;
    let valueOffset = 0;

    if (isExplicitVr) {
      vr = String.fromCharCode(vr0, vr1);
      if (LONG_VR_SET.has(vr)) {
        if (offset + 12 > bytes.length) break;
        valueLength = view.getUint32(offset + 8, true);
        valueOffset = offset + 12;
      } else {
        valueLength = view.getUint16(offset + 6, true);
        valueOffset = offset + 8;
      }
    } else {
      valueLength = view.getUint32(offset + 4, true);
      valueOffset = offset + 8;
    }

    if (group === 0x7fe0 && element === 0x0010) {
      tags.pixelDataOffset = valueOffset;
      tags.pixelDataLength = valueLength === 0xffffffff ? bytes.length - valueOffset : valueLength;
      break;
    }

    if (valueLength === 0xffffffff || valueOffset + valueLength > bytes.length) {
      offset = valueOffset;
      continue;
    }

    const key = `${group.toString(16).padStart(4, '0')},${element.toString(16).padStart(4, '0')}`;
    switch (key) {
      case '0008,0060':
        tags.modality = readCleanAscii(valueOffset, valueLength).toUpperCase();
        break;
      case '0008,0070':
        tags.manufacturer = readCleanAscii(valueOffset, valueLength);
        break;
      case '0008,1030':
        tags.studyDescription = readCleanAscii(valueOffset, valueLength);
        break;
      case '0008,103e':
        tags.seriesDescription = readCleanAscii(valueOffset, valueLength);
        break;
      case '0018,0015':
        tags.bodyPart = readCleanAscii(valueOffset, valueLength).toUpperCase();
        break;
      case '0018,0050':
        tags.sliceThickness = readCleanAscii(valueOffset, valueLength);
        break;
      case '0018,0060':
        tags.kvp = readCleanAscii(valueOffset, valueLength);
        break;
      case '0018,1030':
        tags.protocolName = readCleanAscii(valueOffset, valueLength);
        break;
      case '0018,5101':
        tags.viewPosition = readCleanAscii(valueOffset, valueLength).toUpperCase();
        break;
      case '0020,0060':
      case '0020,0062':
        if (!tags.laterality) {
          tags.laterality = readCleanAscii(valueOffset, valueLength).toUpperCase();
        }
        break;
      case '0028,0004':
        tags.photometric = readCleanAscii(valueOffset, valueLength).toUpperCase();
        break;
      case '0028,0010':
        if (valueLength >= 2) tags.rows = view.getUint16(valueOffset, true);
        break;
      case '0028,0011':
        if (valueLength >= 2) tags.columns = view.getUint16(valueOffset, true);
        break;
      case '0028,0100':
        if (valueLength >= 2) tags.bitsAllocated = view.getUint16(valueOffset, true);
        break;
      case '0028,0101':
        if (valueLength >= 2) tags.bitsStored = view.getUint16(valueOffset, true);
        break;
    }

    offset = valueOffset + valueLength;
  }

  return tags;
}

interface VisualMetrics {
  width: number;
  height: number;
  meanIntensity: number;
  stdContrast: number;
  backgroundPct: number;
  softTissuePct: number;
  denseTissuePct: number;
  hyperdenseFociPct: number;
  relativeDenseRatio: number;
  densityPattern: string;
  quadrantMeans: {
    supEsq: number;
    supDir: number;
    infEsq: number;
    infDir: number;
    central: number;
  };
  dominantQuadrant: string;
  focalQuadrant: string;
  leftRightDiff: number;
}

function computeGrayscaleMetrics(grayPixels: Uint8Array, width: number, height: number): VisualMetrics {
  const total = Math.max(1, grayPixels.length);
  let sum = 0;
  let bg = 0;
  let soft = 0;
  let dense = 0;
  let hyper = 0;

  for (let i = 0; i < grayPixels.length; i += 1) {
    const v = grayPixels[i] ?? 0;
    sum += v;
    if (v < 20) bg += 1;
    else if (v < 135) soft += 1;
    else if (v < 210) dense += 1;
    else hyper += 1;
  }

  const mean = sum / total;
  let sqDiff = 0;
  for (let i = 0; i < grayPixels.length; i += 1) {
    const d = (grayPixels[i] ?? 0) - mean;
    sqDiff += d * d;
  }
  const std = Math.sqrt(sqDiff / total);

  const mx = Math.max(1, Math.floor(width / 2));
  const my = Math.max(1, Math.floor(height / 2));
  let qSumSE = 0, qCntSE = 0, qHighSE = 0;
  let qSumSD = 0, qCntSD = 0, qHighSD = 0;
  let qSumIE = 0, qCntIE = 0, qHighIE = 0;
  let qSumID = 0, qCntID = 0, qHighID = 0;
  let cSum = 0, cCnt = 0;

  const cx0 = Math.floor(width * 0.25);
  const cx1 = Math.floor(width * 0.75);
  const cy0 = Math.floor(height * 0.25);
  const cy1 = Math.floor(height * 0.75);

  for (let y = 0; y < height; y += 1) {
    const rowOff = y * width;
    for (let x = 0; x < width; x += 1) {
      const v = grayPixels[rowOff + x] ?? 0;
      const isHigh = v >= 175 ? 1 : 0;
      if (y < my) {
        if (x < mx) {
          qSumSE += v; qCntSE += 1; qHighSE += isHigh;
        } else {
          qSumSD += v; qCntSD += 1; qHighSD += isHigh;
        }
      } else if (x < mx) {
        qSumIE += v; qCntIE += 1; qHighIE += isHigh;
      } else {
        qSumID += v; qCntID += 1; qHighID += isHigh;
      }
      if (x >= cx0 && x < cx1 && y >= cy0 && y < cy1) {
        cSum += v; cCnt += 1;
      }
    }
  }

  const supEsq = Number((qSumSE / Math.max(1, qCntSE)).toFixed(1));
  const supDir = Number((qSumSD / Math.max(1, qCntSD)).toFixed(1));
  const infEsq = Number((qSumIE / Math.max(1, qCntIE)).toFixed(1));
  const infDir = Number((qSumID / Math.max(1, qCntID)).toFixed(1));
  const central = Number((cSum / Math.max(1, cCnt)).toFixed(1));

  const qMeansList: Array<[string, number]> = [
    ['superior esquerdo', supEsq],
    ['superior direito', supDir],
    ['inferior esquerdo', infEsq],
    ['inferior direito', infDir],
  ];
  qMeansList.sort((a, b) => b[1] - a[1]);
  const dominantQuadrant = qMeansList[0]?.[0] ?? 'central';

  const qHighList: Array<[string, number]> = [
    ['superior esquerdo', qHighSE / Math.max(1, qCntSE)],
    ['superior direito', qHighSD / Math.max(1, qCntSD)],
    ['inferior esquerdo', qHighIE / Math.max(1, qCntIE)],
    ['inferior direito', qHighID / Math.max(1, qCntID)],
  ];
  qHighList.sort((a, b) => b[1] - a[1]);
  const focalQuadrant = qHighList[0]?.[0] ?? 'central';

  const bgPct = Number(((bg / total) * 100).toFixed(1));
  const softPct = Number(((soft / total) * 100).toFixed(1));
  const densePct = Number(((dense / total) * 100).toFixed(1));
  const hyperPct = Number(((hyper / total) * 100).toFixed(1));
  const tissueTotal = Math.max(1, 100 - bgPct);
  const relativeDenseRatio = tissueTotal > 5 ? Number((((densePct + hyperPct) / tissueTotal) * 100).toFixed(1)) : 0;

  let densityPattern = 'predominância radiolucente / baixa atenuação relativa';
  if (relativeDenseRatio >= 55) {
    densityPattern = 'predominantemente denso / alta radiopacidade relativa';
  } else if (relativeDenseRatio >= 30) {
    densityPattern = 'densidade intermediária / distribuição heterogênea fibroglandular';
  } else if (relativeDenseRatio >= 12) {
    densityPattern = 'densidade esparsa com áreas moderadas de atenuação';
  }

  const leftMean = (supEsq + infEsq) / 2;
  const rightMean = (supDir + infDir) / 2;
  const leftRightDiff = Number(Math.abs(leftMean - rightMean).toFixed(1));

  return {
    width,
    height,
    meanIntensity: Number(mean.toFixed(1)),
    stdContrast: Number(std.toFixed(1)),
    backgroundPct: bgPct,
    softTissuePct: softPct,
    denseTissuePct: densePct,
    hyperdenseFociPct: hyperPct,
    relativeDenseRatio,
    densityPattern,
    quadrantMeans: { supEsq, supDir, infEsq, infDir, central },
    dominantQuadrant,
    focalQuadrant,
    leftRightDiff,
  };
}

function renderGrayscaleToJpegBase64(gray: Uint8Array, width: number, height: number): string | undefined {
  try {
    const maxSide = 1024;
    const scale = Math.min(1, maxSide / Math.max(width, height, 1));
    const outW = Math.max(1, Math.round(width * scale));
    const outH = Math.max(1, Math.round(height * scale));

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = width;
    srcCanvas.height = height;
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) return undefined;

    const imgData = srcCtx.createImageData(width, height);
    const data = imgData.data;
    for (let i = 0; i < gray.length; i += 1) {
      const v = gray[i] ?? 0;
      const p = i * 4;
      data[p] = v;
      data[p + 1] = v;
      data[p + 2] = v;
      data[p + 3] = 255;
    }
    srcCtx.putImageData(imgData, 0, 0);

    const dstCanvas = document.createElement('canvas');
    dstCanvas.width = outW;
    dstCanvas.height = outH;
    const dstCtx = dstCanvas.getContext('2d');
    if (!dstCtx) return undefined;
    dstCtx.drawImage(srcCanvas, 0, 0, outW, outH);

    const dataUrl = dstCanvas.toDataURL('image/jpeg', 0.88);
    const commaIdx = dataUrl.indexOf(',');
    return commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : undefined;
  } catch {
    return undefined;
  }
}

async function decodeImageBlobToMetrics(blob: Blob): Promise<{ metrics: VisualMetrics; jpegBase64?: string } | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const maxSide = 1024;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height, 1));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const rgba = ctx.getImageData(0, 0, w, h).data;
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i += 1) {
      const p = i * 4;
      const r = rgba[p] ?? 0;
      const g = rgba[p + 1] ?? 0;
      const b = rgba[p + 2] ?? 0;
      gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    const metrics = computeGrayscaleMetrics(gray, bitmap.width, bitmap.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const commaIdx = dataUrl.indexOf(',');
    const jpegBase64 = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : undefined;
    return { metrics, jpegBase64 };
  } catch {
    return null;
  }
}

/** Analisa um arquivo de imagem (DICOM ou convencional) localmente com especificidade. */
export async function analyzeImageFileLocally(file: File): Promise<LocalImageAnalysisResult> {
  const lower = file.name.toLowerCase();
  const isDicomExt = /\.(dcm|dicom|ima)$/i.test(lower);
  const isImageExt = /\.(jpg|jpeg|png|webp|bmp|tif|tiff)$/i.test(lower);

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const hasDicmMagic =
    bytes.length >= 132 &&
    bytes[128] === 0x44 &&
    bytes[129] === 0x49 &&
    bytes[130] === 0x43 &&
    bytes[131] === 0x4d;

  const isDicom = isDicomExt || hasDicmMagic;
  const isImageOrDicom = isDicom || isImageExt;
  const fileHashShort = computeSimpleHash(bytes);

  if (!isImageOrDicom) {
    return {
      isImageOrDicom: false,
      isDicom: false,
      filename: file.name,
      fileHashShort,
      technicalSummary: '',
      specificObjectiveReply: '',
    };
  }

  let tags: ParsedDicomTags = {};
  let metrics: VisualMetrics | null = null;
  let jpegBase64: string | undefined;

  if (isDicom) {
    tags = parseDicomBinaryTags(bytes);
    const rows = tags.rows || 0;
    const cols = tags.columns || 0;
    const bitsAlloc = tags.bitsAllocated || 16;
    const bitsStored = tags.bitsStored || bitsAlloc;
    const invert = tags.photometric === 'MONOCHROME1';

    if (rows > 0 && cols > 0 && tags.pixelDataOffset !== undefined) {
      const pxStart = tags.pixelDataOffset;
      const numPx = rows * cols;
      if (bitsAlloc === 16 && pxStart + numPx * 2 <= bytes.length) {
        const view = new DataView(bytes.buffer, bytes.byteOffset + pxStart, numPx * 2);
        const rawVals = new Float32Array(numPx);
        const mask = bitsStored < 16 ? (1 << bitsStored) - 1 : 0xffff;
        const sampleStep = Math.max(1, Math.floor(numPx / 10000));
        const sampled: number[] = [];
        for (let i = 0; i < numPx; i += 1) {
          const v = view.getUint16(i * 2, true) & mask;
          rawVals[i] = v;
          if (i % sampleStep === 0) sampled.push(v);
        }
        sampled.sort((a, b) => a - b);
        const pLow = sampled[Math.floor(sampled.length * 0.01)] ?? 0;
        const pHigh = sampled[Math.floor(sampled.length * 0.995)] ?? 1;
        const span = pHigh > pLow ? pHigh - pLow : 1;
        const gray = new Uint8Array(numPx);
        for (let i = 0; i < numPx; i += 1) {
          const rv = rawVals[i] ?? 0;
          const scaled = Math.max(0, Math.min(255, Math.round(((rv - pLow) / span) * 255)));
          gray[i] = invert ? 255 - scaled : scaled;
        }
        metrics = computeGrayscaleMetrics(gray, cols, rows);
        jpegBase64 = renderGrayscaleToJpegBase64(gray, cols, rows);
      } else if (bitsAlloc === 8 && pxStart + numPx <= bytes.length) {
        const gray = new Uint8Array(numPx);
        for (let i = 0; i < numPx; i += 1) {
          const v = bytes[pxStart + i] ?? 0;
          gray[i] = invert ? 255 - v : v;
        }
        metrics = computeGrayscaleMetrics(gray, cols, rows);
        jpegBase64 = renderGrayscaleToJpegBase64(gray, cols, rows);
      }
    }

    // Caso o DICOM possua frame JPEG encapsulado
    if (!metrics) {
      for (let i = tags.pixelDataOffset ?? 0; i < bytes.length - 3; i += 1) {
        if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
          const jpegBlob = new Blob([bytes.subarray(i)], { type: 'image/jpeg' });
          const decoded = await decodeImageBlobToMetrics(jpegBlob);
          if (decoded) {
            metrics = decoded.metrics;
            jpegBase64 = decoded.jpegBase64;
          }
          break;
        }
      }
    }
  } else {
    const decoded = await decodeImageBlobToMetrics(file);
    if (decoded) {
      metrics = decoded.metrics;
      jpegBase64 = decoded.jpegBase64;
    }
  }

  const modCode = (tags.modality || '').toUpperCase();
  const modalityLabel = MODALITY_LABELS[modCode] || (isDicom ? modCode || 'Exame de Imagem DICOM' : 'Imagem Digital');
  const lateralityLabel = tags.laterality ? LATERALITY_LABELS[tags.laterality] || tags.laterality : '';
  const viewLabel = tags.viewPosition ? VIEW_LABELS[tags.viewPosition] || tags.viewPosition : '';

  const headerParts = [`Modalidade: ${modalityLabel}`];
  if (tags.bodyPart) headerParts.push(`Região anatômica: ${tags.bodyPart}`);
  if (lateralityLabel) headerParts.push(`Lateralidade: ${lateralityLabel}`);
  if (viewLabel) headerParts.push(`Incidência/Projeção: ${viewLabel}`);

  const seriesParts = [tags.studyDescription, tags.seriesDescription, tags.protocolName].filter(Boolean);

  const replyLines: string[] = [
    `Realizei a análise técnica e visual individual do arquivo ${file.name} (identificador único #${fileHashShort}).`,
    '',
    '• Identificação da Imagem:',
    `  - ${headerParts.join(' | ')}.`,
  ];
  if (seriesParts.length > 0) {
    replyLines.push(`  - Descrição técnica da série: ${seriesParts.join(' — ')}.`);
  }

  const w = tags.columns || metrics?.width;
  const h = tags.rows || metrics?.height;
  const specs: string[] = [];
  if (w && h) specs.push(`matriz de ${w}x${h} pixels`);
  if (tags.bitsStored) specs.push(`${tags.bitsStored} bits de profundidade`);
  if (tags.photometric) specs.push(`fotometria ${tags.photometric}`);
  if (tags.kvp) specs.push(`${tags.kvp} kVp`);
  if (tags.sliceThickness) specs.push(`espessura de corte ${tags.sliceThickness} mm`);
  if (specs.length > 0) {
    replyLines.push(`  - Parâmetros técnicos extraídos: ${specs.join(', ')}.`);
  }

  if (metrics) {
    replyLines.push(
      '',
      '• Análise Visual e Quantitativa Específica desta Imagem:',
      `  - Padrão de densidade/atenuação: observa-se ${metrics.densityPattern}, com ${metrics.relativeDenseRatio}% da área útil apresentando maior radiopacidade, ${metrics.softTissuePct}% de atenuação intermediária e ${metrics.denseTissuePct}% de feixes densos.`,
      `  - Distribuição por quadrantes: maior concentração de brilho/densidade no quadrante ${metrics.dominantQuadrant} (médias 0–255: Sup. Esq. ${metrics.quadrantMeans.supEsq}, Sup. Dir. ${metrics.quadrantMeans.supDir}, Inf. Esq. ${metrics.quadrantMeans.infEsq}, Inf. Dir. ${metrics.quadrantMeans.infDir}, Região Central ${metrics.quadrantMeans.central}).`,
    );
    if (metrics.hyperdenseFociPct >= 2.5) {
      replyLines.push(
        `  - Áreas hiperintensas / radiopacas: identificam-se ${metrics.hyperdenseFociPct}% de pixels de alta intensidade (>210/255), predominando no quadrante ${metrics.focalQuadrant}, compatíveis com estruturas de maior atenuação radiológica ou marcadores da incidência.`,
      );
    } else {
      replyLines.push(
        `  - Focos de alta intensidade: baixa proporção (${metrics.hyperdenseFociPct}%) de pontos de brilho extremo (>210/255), concentrados principalmente no quadrante ${metrics.focalQuadrant}.`,
      );
    }
    replyLines.push(
      `  - Contraste global: luminância média de ${metrics.meanIntensity}/255 e desvio-padrão de contraste de ${metrics.stdContrast} (diferença lateral média de ${metrics.leftRightDiff} pontos).`,
    );
  }

  replyLines.push(
    '',
    '• Orientação Objetiva:',
    '  - Esta avaliação descreve objetivamente as características visuais e técnicas específicas da imagem enviada.',
    '  - Leve o exame ao médico responsável para correlação clínica presencial. Quer tirar dúvidas sobre algum detalhe específico observado nesta imagem?',
    '',
    'Aviso Médico RNF13: Esta orientação é exclusivamente educativa e de apoio emocional. Ela não constitui diagnóstico médico e não substitui a consulta com um médico mastologista ou ginecologista.',
  );

  const specificObjectiveReply = replyLines.join('\n');
  const technicalSummary = replyLines.slice(0, -3).join('\n');

  return {
    isImageOrDicom: true,
    isDicom,
    filename: file.name,
    fileHashShort,
    jpegBase64,
    jpegMimeType: jpegBase64 ? 'image/jpeg' : undefined,
    technicalSummary,
    specificObjectiveReply,
  };
}
