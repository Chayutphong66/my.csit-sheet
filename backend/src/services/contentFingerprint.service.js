import crypto from 'node:crypto'

const MIN_FINGERPRINT_CHARACTERS = 24
const MAX_EXTRACTED_CHARACTERS = 2_000_000

export function normalizeExtractedText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLowerCase()
}

function decodePdfLiteral(value) {
  return value
    .replace(/\\([0-7]{1,3})/g, (_match, octal) => String.fromCharCode(Number.parseInt(octal, 8)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\([()\\])/g, '$1')
}

function extractSimplePdfText(buffer) {
  // This deliberately handles only literal text-showing operators. Compressed,
  // encrypted, image-only, or structurally complex PDFs fall back to other
  // duplicate signals instead of producing a low-confidence fingerprint.
  const source = buffer.toString('latin1', 0, Math.min(buffer.length, MAX_EXTRACTED_CHARACTERS))
  const fragments = []
  const operatorPattern = /\(((?:\\.|[^()\\])*)\)\s*(?:Tj|['"])/g
  for (const match of source.matchAll(operatorPattern)) fragments.push(decodePdfLiteral(match[1]))

  const arrayPattern = /\[((?:[^\]]|\](?!\s*TJ))*)\]\s*TJ/g
  for (const arrayMatch of source.matchAll(arrayPattern)) {
    const literalPattern = /\(((?:\\.|[^()\\])*)\)/g
    for (const literal of arrayMatch[1].matchAll(literalPattern)) fragments.push(decodePdfLiteral(literal[1]))
  }
  return fragments.join(' ')
}

export function extractFingerprintText(fileData, mimeType = '') {
  try {
    const buffer = Buffer.from(fileData ?? [])
    if (!buffer.length) return ''
    if (mimeType === 'text/plain') return buffer.toString('utf8', 0, Math.min(buffer.length, MAX_EXTRACTED_CHARACTERS))
    if (mimeType === 'application/pdf' && buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      return extractSimplePdfText(buffer)
    }
  } catch {
    return ''
  }
  return ''
}

export function calculateContentFingerprint(fileData, mimeType = '') {
  const normalized = normalizeExtractedText(extractFingerprintText(fileData, mimeType))
  if (normalized.length < MIN_FINGERPRINT_CHARACTERS) return ''
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex')
}
