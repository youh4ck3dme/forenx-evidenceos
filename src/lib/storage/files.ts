import { getDb } from "@/lib/storage/db";

const ROOT = "forenx";

async function opfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  const storage = navigator.storage;
  if (!storage || typeof storage.getDirectory !== "function") return null;
  try {
    return await storage.getDirectory();
  } catch {
    return null;
  }
}

async function ensureDir(
  root: FileSystemDirectoryHandle,
  segments: string[],
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const segment of segments) {
    dir = await dir.getDirectoryHandle(segment, { create: true });
  }
  return dir;
}

export function originalPath(caseId: string, evidenceId: string): string {
  return `/${ROOT}/cases/${caseId}/originals/${evidenceId}`;
}

export async function writeOriginal(caseId: string, evidenceId: string, blob: Blob): Promise<string> {
  const path = originalPath(caseId, evidenceId);
  const root = await opfsRoot();
  if (root) {
    const dir = await ensureDir(root, [ROOT, "cases", caseId, "originals"]);
    const handle = await dir.getFileHandle(evidenceId, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return path;
  }
  await getDb().blobs.put({
    id: path,
    caseId,
    evidenceId,
    kind: "original",
    blob,
  });
  return path;
}

export async function readOriginal(caseId: string, evidenceId: string): Promise<Blob | null> {
  const path = originalPath(caseId, evidenceId);
  const root = await opfsRoot();
  if (root) {
    try {
      const dir = await ensureDir(root, [ROOT, "cases", caseId, "originals"]);
      const handle = await dir.getFileHandle(evidenceId);
      return await handle.getFile();
    } catch {
      // Fall through to IndexedDB blobs.
    }
  }
  const rec = await getDb().blobs.get(path);
  return rec?.blob ?? null;
}

export async function estimateStorage(): Promise<{ used: number; quota: number }> {
  try {
    const est = await navigator.storage?.estimate?.();
    return { used: est?.usage ?? 0, quota: est?.quota ?? 0 };
  } catch {
    return { used: 0, quota: 0 };
  }
}
