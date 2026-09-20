import * as pdfjs from 'pdfjs-dist'
import mammoth from 'mammoth'
import { marked } from 'marked'
import { parseRtfToText } from './normalize'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export interface ExtractionResult {
  text: string
  pageCount?: number
  languageHints: string[]
  structured?: Record<string, unknown>
  ocrConfidence?: number
  processor: string
  processorVersion: string
}

export async function extractContent(
  file: File,
  formatId?: string,
): Promise<ExtractionResult> {
  const id = formatId ?? ''
  if (id === 'pdf' || file.type === 'application/pdf') {
    return extractPdf(file)
  }
  if (id === 'docx' || file.name.toLowerCase().endsWith('.docx')) {
    return extractDocx(file)
  }
  if (id === 'rtf' || file.name.toLowerCase().endsWith('.rtf')) {
    const text = await parseRtfToText(file)
    return {
      text,
      languageHints: [],
      processor: 'rtf-parser',
      processorVersion: '0.1.0',
    }
  }
  if (
    id === 'markdown' ||
    file.name.toLowerCase().endsWith('.md') ||
    file.type === 'text/markdown'
  ) {
    const text = await file.text()
    return {
      text,
      languageHints: [],
      structured: { htmlPreviewSafe: false },
      processor: 'markdown',
      processorVersion: marked.defaults ? 'marked' : '0.1.0',
    }
  }
  if (
    ['text', 'csv', 'json', 'xml', 'html'].includes(id) ||
    file.type.startsWith('text/') ||
    /\.(txt|csv|json|xml|html|htm)$/i.test(file.name)
  ) {
    const text = await file.text()
    return {
      text,
      languageHints: [],
      processor: 'text-decoder',
      processorVersion: '0.1.0',
    }
  }
  if (file.type.startsWith('image/') || ['png', 'jpeg', 'webp', 'heic', 'avif'].includes(id)) {
    return {
      text: `[Image evidence: ${file.name}] No OCR text extracted yet. Run OCR & Structure for document AI OCR.`,
      languageHints: [],
      processor: 'image-stub',
      processorVersion: '0.1.0',
      ocrConfidence: 0,
    }
  }

  return {
    text: '',
    languageHints: [],
    processor: 'none',
    processorVersion: '0.1.0',
  }
}

async function extractPdf(file: File): Promise<ExtractionResult> {
  const data = new Uint8Array(await file.arrayBuffer())
  const task = pdfjs.getDocument({ data })
  try {
    const doc = await task.promise
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const strings = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
      pages.push(strings.join(' '))
    }
    return {
      text: pages.join('\n\n'),
      pageCount: doc.numPages,
      languageHints: [],
      processor: 'pdf.js',
      processorVersion: pdfjs.version,
    }
  } finally {
    try {
      task.destroy()
    } catch {
      /* ignore */
    }
  }
}

async function extractDocx(file: File): Promise<ExtractionResult> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return {
    text: result.value,
    languageHints: [],
    processor: 'mammoth',
    processorVersion: '1.x',
  }
}

export { pdfjs }
