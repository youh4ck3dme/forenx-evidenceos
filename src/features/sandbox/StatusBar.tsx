import { Download, Hash, Plus, ScrollText, Search } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { ThemeSwitch } from "@/features/theme/ThemeSwitch";
import { selectCaseRisk, selectSelectedEvidence, useWorkspace } from "@/features/workspace/store";
import { skCount } from "@/lib/copy";
import { cn, formatBytes, shortHash } from "@/lib/utils";

const BAND_SK: Record<string, string> = {
  LOW: "nízke",
  MODERATE: "stredné",
  ELEVATED: "zvýšené",
  HIGH: "vysoké",
};

export function StatusBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const importFiles = useWorkspace((s) => s.importFiles);
  const exportCase = useWorkspace((s) => s.exportCase);
  const setCommandOpen = useWorkspace((s) => s.setCommandOpen);
  const setAuditOpen = useWorkspace((s) => s.setAuditOpen);
  const auditCount = useWorkspace((s) => s.audit.length);
  const storageUsed = useWorkspace((s) => s.storageUsed);
  const storageQuota = useWorkspace((s) => s.storageQuota);
  const evidenceCount = useWorkspace((s) => s.evidence.length);
  const selected = useWorkspace(selectSelectedEvidence);
  const risk = useWorkspace(selectCaseRisk);
  const ingestBusy = useWorkspace((s) => s.ingestBusy);
  const ratio = storageQuota > 0 ? storageUsed / storageQuota : 0;
  const warn = ratio > 0.8;

  return (
    <footer className="shrink-0 border-t border-border bg-surface pb-[max(0px,env(safe-area-inset-bottom,0px))]">
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
      <div className="flex h-5 items-center justify-center gap-2 px-3 font-mono text-[10px] text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1 truncate">
          <Hash className="size-3 shrink-0" />
          {selected ? shortHash(selected.sha256, 10) : "hash —"}
        </span>
        <span className="text-subtle">·</span>
        <span className={cn("shrink-0", warn && "text-warn")}>
          {formatBytes(storageUsed)}
          {storageQuota ? ` / ${formatBytes(storageQuota)}` : ""}
        </span>
        <span className="text-subtle">·</span>
        <span className="shrink-0">{skCount(evidenceCount, "položka", "položky", "položiek")}</span>
        <span className="text-subtle">·</span>
        <span
          className={cn(
            "shrink-0",
            risk.band === "HIGH" && "text-destructive",
            risk.band === "ELEVATED" && "text-warn",
          )}
          title="Vyšetrovací index zistení, nie verdikt viny"
        >
          riziko {risk.index} {BAND_SK[risk.band] ?? risk.band}
        </span>
      </div>
      <nav
        aria-label="Hlavné menu"
        className="grid h-14 w-full grid-cols-5 items-center justify-items-center px-1 md:h-14"
      >
        <DockButton
          label="Pridať"
          disabled={ingestBusy}
          onClick={() => inputRef.current?.click()}
        >
          <Plus className="size-5" strokeWidth={1.75} />
        </DockButton>
        <DockButton label="Príkazy" onClick={() => setCommandOpen(true)}>
          <Search className="size-5" strokeWidth={1.75} />
        </DockButton>
        <DockButton label={`Záznam ${auditCount}`} onClick={() => setAuditOpen(true)}>
          <ScrollText className="size-5" strokeWidth={1.75} />
        </DockButton>
        <DockButton label="Export" onClick={() => void exportCase("markdown")}>
          <Download className="size-5" strokeWidth={1.75} />
        </DockButton>
        <div className="flex min-h-11 w-full flex-col items-center justify-center gap-0.5">
          <ThemeSwitch className="h-8" />
          <span className="text-[11px] leading-none text-foreground">Téma</span>
        </div>
      </nav>
    </footer>
  );
}

function DockButton({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-11 w-full flex-col items-center justify-center gap-0.5 text-foreground disabled:opacity-40"
    >
      {children}
      <span className="max-w-full truncate px-0.5 text-[11px] leading-none">{label}</span>
    </button>
  );
}
