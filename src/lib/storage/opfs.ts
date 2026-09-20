/**
 * Origin Private File System adapter for immutable originals and derived artifacts.
 * Path model: /forenx/cases/{caseId}/{originals|normalized|previews|exports}/...
 */

export type OpfsBucket = 'originals' | 'normalized' | 'previews' | 'exports'

async function getRoot(): Promise<FileSystemDirectoryHandle> {
  if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
    throw new Error('OPFS is not supported in this browser')
  }
  return navigator.storage.getDirectory()
}

async function ensureDir(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle> {
  return parent.getDirectoryHandle(name, { create: true })
}

async function resolveCaseBucket(
  caseId: string,
  bucket: OpfsBucket,
): Promise<FileSystemDirectoryHandle> {
  const root = await getRoot()
  const forenx = await ensureDir(root, 'forenx')
  const cases = await ensureDir(forenx, 'cases')
  const caseDir = await ensureDir(cases, caseId)
  return ensureDir(caseDir, bucket)
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 180)
}

export function buildStoragePath(
  caseId: string,
  bucket: OpfsBucket,
  filename: string,
): string {
  return `/forenx/cases/${caseId}/${bucket}/${safeName(filename)}`
}

export async function writeOpfsFile(
  caseId: string,
  bucket: OpfsBucket,
  filename: string,
  data: Blob | ArrayBuffer | Uint8Array,
): Promise<string> {
  const dir = await resolveCaseBucket(caseId, bucket)
  const handle = await dir.getFileHandle(safeName(filename), { create: true })
  const writable = await handle.createWritable()
  try {
    await writable.write(data as Blob)
  } finally {
    await writable.close()
  }
  return buildStoragePath(caseId, bucket, filename)
}

export async function readOpfsFile(
  caseId: string,
  bucket: OpfsBucket,
  filename: string,
): Promise<File> {
  const dir = await resolveCaseBucket(caseId, bucket)
  const handle = await dir.getFileHandle(safeName(filename))
  return handle.getFile()
}

export async function readOpfsByPath(storagePath: string): Promise<File> {
  const parts = storagePath.replace(/^\//, '').split('/')
  // forenx / cases / {caseId} / {bucket} / {filename...}
  if (parts.length < 5 || parts[0] !== 'forenx' || parts[1] !== 'cases') {
    throw new Error(`Invalid OPFS path: ${storagePath}`)
  }
  const caseId = parts[2]
  const bucket = parts[3] as OpfsBucket
  const filename = parts.slice(4).join('/')
  return readOpfsFile(caseId, bucket, filename)
}

export async function opfsSupported(): Promise<boolean> {
  try {
    await getRoot()
    return true
  } catch {
    return false
  }
}

export async function estimateStorage(): Promise<{
  usage: number
  quota: number
}> {
  if (!navigator.storage?.estimate) {
    return { usage: 0, quota: 0 }
  }
  const estimate = await navigator.storage.estimate()
  return {
    usage: estimate.usage ?? 0,
    quota: estimate.quota ?? 0,
  }
}

/** Fallback in-memory blob store when OPFS is unavailable (dev/older browsers). */
const memoryBlobs = new Map<string, Blob>()

export async function writeEvidenceBlob(
  caseId: string,
  bucket: OpfsBucket,
  filename: string,
  data: Blob,
): Promise<string> {
  const path = buildStoragePath(caseId, bucket, filename)
  // Always keep an in-session mirror. WebKit OPFS reads can hang/fail with
  // transient UnknownError even after a successful write.
  memoryBlobs.set(path, data)
  try {
    await writeOpfsFile(caseId, bucket, filename, data)
  } catch {
    /* memory mirror is enough for this session */
  }
  return path
}

export async function readEvidenceBlob(storagePath: string): Promise<Blob> {
  const mirrored = memoryBlobs.get(storagePath)
  if (mirrored) return mirrored
  try {
    return await readOpfsByPath(storagePath)
  } catch {
    throw new Error(`Evidence blob not found: ${storagePath}`)
  }
}
