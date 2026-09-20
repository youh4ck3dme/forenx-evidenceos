import { Hash, Plus, ScrollText, Search, Shield } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ThemeSwitch } from "@/features/theme/ThemeSwitch";
import { selectSelectedEvidence, useWorkspace } from "@/features/workspace/store";
import { skCount } from "@/lib/copy";
import { formatBytes, shortHash } from "@/lib/utils";

export function StatusBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const importFiles = useWorkspace((s) => s.importFiles);
  const setCommandOpen = useWorkspace((s) => s.setCommandOpen);
  const setAuditOpen = useWorkspace((s) => s.setAuditOpen);
  const auditCount = useWorkspace((s) => s.audit.length);
  const storageUsed = useWorkspace((s) => s.storageUsed);
  const storageQuota = useWorkspace((s) => s.storageQuota);
  const evidenceCount = useWorkspace((s) => s.evidence.length);
  const selected = useWorkspace(selectSelectedEvidence);
  const ingestBusy = useWorkspace((s) => s.ingestBusy);
  const ratio = storageQuota > 0 ? storageUsed / storageQuota : 0;
  const warn = ratio > 0.8;

  return (
    <footer className="flex h-11 shrink-0 items-center gap-2 border-t border-border bg-surface px-2 text-2xs max-md:overflow-x-auto">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void importFiles(files);
        }}
      />
      <Button size="sm" variant="outline" className="h-8" onClick={() => inputRef.current?.click()} disabled={ingestBusy}>
        <Plus className="size-3.5" />
        Pridať dôkaz
      </Button>
      <Button size="sm" variant="ghost" className="h-8" onClick={() => setCommandOpen(true)}>
        <Search className="size-3.5" />
        <span className="max-md:hidden">Príkazy</span>
        <kbd className="ml-1 hidden rounded-sm border border-border px-1 font-mono text-2xs text-subtle md:inline">⌘K</kbd>
      </Button>
      <div className="mx-1 hidden h-4 w-px bg-border md:block" />
      <span className="flex items-center gap-1.5 font-mono text-muted-foreground">
        <Hash className="size-3" />
        {selected ? shortHash(selected.sha256, 8) : "žiadny súbor"}
      </span>
      <button type="button" className="ml-auto flex items-center gap-1.5 px-2 text-muted-foreground hover:text-foreground" onClick={() => setAuditOpen(true)}>
        <ScrollText className="size-3" />
        Záznam {auditCount}
      </button>
      <span className={`flex items-center gap-1.5 font-mono ${warn ? "text-warn" : "text-muted-foreground"}`}>
        <Shield className="size-3" />
        {formatBytes(storageUsed)}
        {storageQuota ? ` / ${formatBytes(storageQuota)}` : ""}
        <span className="text-subtle">· {skCount(evidenceCount, "položka", "položky", "položiek")}</span>
      </span>
      <ThemeSwitch />
    </footer>
  );
}
