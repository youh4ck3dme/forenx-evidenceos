import { t } from '@/lib/i18n'
export interface FormatDefinition {
  id: string
  extensions: string[]
  mimeTypes: string[]
  signatures: Array<{ offset: number; bytes: number[] }>
  route: 'NATIVE' | 'NORMALIZE' | 'QUARANTINE'
  normalizeTo?: 'png' | 'text'
  category: 'document' | 'image' | 'text' | 'data' | 'unknown'
}


export const MVP_FORMATS: FormatDefinition[] = [
  {
    id: 'pdf',
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    signatures: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }],
    route: 'NATIVE',
    category: 'document',
  },
  {
    id: 'png',
    extensions: ['.png'],
    mimeTypes: ['image/png'],
    signatures: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }],
    route: 'NATIVE',
    category: 'image',
  },
  {
    id: 'jpeg',
    extensions: ['.jpg', '.jpeg', '.jpe', '.joeg', '.jog'],
    mimeTypes: ['image/jpeg'],
    signatures: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
    route: 'NATIVE',
    category: 'image',
  },
  {
    id: 'webp',
    extensions: ['.webp'],
    mimeTypes: ['image/webp'],
    signatures: [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }],
    route: 'NORMALIZE',
    normalizeTo: 'png',
    category: 'image',
  },
  {
    id: 'heic',
    extensions: ['.heic', '.heif'],
    mimeTypes: ['image/heic', 'image/heif'],
    signatures: [],
    route: 'NORMALIZE',
    normalizeTo: 'png',
    category: 'image',
  },
  {
    id: 'avif',
    extensions: ['.avif'],
    mimeTypes: ['image/avif'],
    signatures: [],
    route: 'NORMALIZE',
    normalizeTo: 'png',
    category: 'image',
  },
  {
    id: 'docx',
    extensions: ['.docx'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    signatures: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
    route: 'NATIVE',
    category: 'document',
  },
  {
    id: 'rtf',
    extensions: ['.rtf'],
    mimeTypes: ['application/rtf', 'text/rtf'],
    signatures: [{ offset: 0, bytes: [0x7b, 0x5c, 0x72, 0x74, 0x66] }],
    route: 'NORMALIZE',
    normalizeTo: 'text',
    category: 'document',
  },
  {
    id: 'markdown',
    extensions: ['.md', '.markdown'],
    mimeTypes: ['text/markdown'],
    signatures: [],
    route: 'NATIVE',
    category: 'text',
  },
  {
    id: 'text',
    extensions: ['.txt', '.log'],
    mimeTypes: ['text/plain'],
    signatures: [],
    route: 'NATIVE',
    category: 'text',
  },
  {
    id: 'csv',
    extensions: ['.csv'],
    mimeTypes: ['text/csv'],
    signatures: [],
    route: 'NATIVE',
    category: 'data',
  },
  {
    id: 'json',
    extensions: ['.json'],
    mimeTypes: ['application/json'],
    signatures: [],
    route: 'NATIVE',
    category: 'data',
  },
  {
    id: 'xml',
    extensions: ['.xml'],
    mimeTypes: ['application/xml', 'text/xml'],
    signatures: [],
    route: 'NATIVE',
    category: 'data',
  },
  {
    id: 'html',
    extensions: ['.html', '.htm'],
    mimeTypes: ['text/html'],
    signatures: [],
    route: 'NATIVE',
    category: 'text',
  },
]

const EXECUTABLE_SIGNATURES: Array<{
  bytes: number[]
  reasonKey: 'quarantine.mz' | 'quarantine.elf' | 'quarantine.macho'
}> = [
  { bytes: [0x4d, 0x5a], reasonKey: 'quarantine.mz' },
  { bytes: [0x7f, 0x45, 0x4c, 0x46], reasonKey: 'quarantine.elf' },
  { bytes: [0xca, 0xfe, 0xba, 0xbe], reasonKey: 'quarantine.macho' },
]

function matchesSignature(
  header: Uint8Array,
  signature: { offset: number; bytes: number[] },
): boolean {
  if (header.length < signature.offset + signature.bytes.length) return false
  return signature.bytes.every(
    (byte, index) => header[signature.offset + index] === byte,
  )
}

export function getExtension(filename: string): string {
  const lower = filename.toLowerCase()
  const idx = lower.lastIndexOf('.')
  if (idx < 0) return ''
  return lower.slice(idx)
}

export interface DetectionResult {
  format: FormatDefinition | null
  detectedMime: string
  route: 'NATIVE' | 'NORMALIZE' | 'QUARANTINE'
  quarantineReason?: string
}

export async function detectFormat(file: File): Promise<DetectionResult> {
  const header = new Uint8Array(await file.slice(0, 64).arrayBuffer())
  const extension = getExtension(file.name)

  for (const exe of EXECUTABLE_SIGNATURES) {
    if (matchesSignature(header, { offset: 0, bytes: exe.bytes })) {
      return {
        format: null,
        detectedMime: 'application/octet-stream',
        route: 'QUARANTINE',
        quarantineReason: t(exe.reasonKey),
      }
    }
  }

  const bySignature = MVP_FORMATS.find((format) =>
    format.signatures.some((sig) => matchesSignature(header, sig)),
  )

  if (bySignature) {
    // WEBP RIFF check
    if (bySignature.id === 'webp') {
      const tag = String.fromCharCode(...header.slice(8, 12))
      if (tag !== 'WEBP') {
        // fall through to extension
      } else {
        return {
          format: bySignature,
          detectedMime: bySignature.mimeTypes[0] ?? file.type,
          route: bySignature.route,
        }
      }
    } else {
      return {
        format: bySignature,
        detectedMime: bySignature.mimeTypes[0] ?? file.type,
        route: bySignature.route,
      }
    }
  }

  // HEIC/AVIF ftyp brand
  if (
    header.length >= 12 &&
    String.fromCharCode(...header.slice(4, 8)) === 'ftyp'
  ) {
    const brand = String.fromCharCode(...header.slice(8, 12))
    if (['heic', 'heif', 'mif1', 'msf1'].includes(brand)) {
      const format = MVP_FORMATS.find((f) => f.id === 'heic')!
      return {
        format,
        detectedMime: 'image/heic',
        route: 'NORMALIZE',
      }
    }
    if (['avif', 'avis'].includes(brand)) {
      const format = MVP_FORMATS.find((f) => f.id === 'avif')!
      return {
        format,
        detectedMime: 'image/avif',
        route: 'NORMALIZE',
      }
    }
  }

  const byExt = MVP_FORMATS.find((format) =>
    format.extensions.includes(extension),
  )
  if (byExt) {
    return {
      format: byExt,
      detectedMime:
        byExt.mimeTypes[0] ?? (file.type || 'application/octet-stream'),
      route: byExt.route,
    }
  }

  return {
    format: null,
    detectedMime: file.type || 'application/octet-stream',
    route: 'QUARANTINE',
    quarantineReason: t('quarantine.unknown'),
  }
}
