export function createId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${rand.slice(0, 16)}`;
}

export function nextCaseReference(existing: string[]): string {
  let max = 0;
  for (const ref of existing) {
    const match = /^FX-(\d+)$/i.exec(ref.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `FX-${String(max + 1).padStart(3, "0")}`;
}
