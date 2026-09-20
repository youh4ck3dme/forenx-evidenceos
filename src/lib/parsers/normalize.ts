export async function normalizeImageToPng(file: File): Promise<Blob> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.heic') || name.endsWith('.heif') || file.type.includes('heic')) {
    try {
      const heic2any = (await import('heic2any')).default
      const converted = await heic2any({
        blob: file,
        toType: 'image/png',
        quality: 0.92,
      })
      const blob = Array.isArray(converted) ? converted[0] : converted
      return blob
    } catch (error) {
      throw new Error(
        `HEIC conversion failed: ${error instanceof Error ? error.message : 'unknown'}`,
      )
    }
  }

  // Canvas path for webp/avif/jpeg/png
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) throw new Error('PNG encode failed')
  return blob
}

/** Minimal RTF → plain text (control words stripped). Derived artifact only. */
export async function parseRtfToText(file: File): Promise<string> {
  const raw = await file.text()
  return rtfToPlain(raw)
}

export function rtfToPlain(rtf: string): string {
  let text = rtf
  text = text.replace(/\{\\fonttbl[\s\S]*?\}/g, '')
  text = text.replace(/\{\\colortbl[\s\S]*?\}/g, '')
  text = text.replace(/\{\\stylesheet[\s\S]*?\}/g, '')
  text = text.replace(/\\'[0-9a-fA-F]{2}/g, (m) =>
    String.fromCharCode(parseInt(m.slice(2), 16)),
  )
  text = text.replace(/\\u(-?\d+)\??/g, (_, n: string) => {
    const code = Number(n)
    return code < 0 ? String.fromCharCode(code + 65536) : String.fromCharCode(code)
  })
  text = text.replace(/\\par[d]?/g, '\n')
  text = text.replace(/\\line/g, '\n')
  text = text.replace(/\\tab/g, '\t')
  text = text.replace(/\\[a-z]+\d* ?/gi, '')
  text = text.replace(/[{}]/g, '')
  text = text.replace(/\r\n/g, '\n')
  return text.replace(/\n{3,}/g, '\n\n').trim()
}
