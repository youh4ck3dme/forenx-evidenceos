export async function sha256Hex(data: ArrayBuffer | Blob | Uint8Array): Promise<string> {
  let buffer: ArrayBuffer
  if (data instanceof ArrayBuffer) {
    buffer = data
  } else if (data instanceof Uint8Array) {
    buffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer
  } else {
    buffer = await data.arrayBuffer()
  }
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
