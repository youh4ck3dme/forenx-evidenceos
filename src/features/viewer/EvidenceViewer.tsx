import { FileWarning, Lock, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVIDENCE_SECTIONS, type EvidenceRecord, type ExtractionRecord } from "@/domain/types";
import { useWorkspace } from "@/features/workspace/store";
import {
  EVIDENCE_STATUS_LABEL,
  KIND_LABEL,
  LANE_LABEL,
  SECTION_LABEL,
  SECTION_SOURCE_LABEL,
  enumLabel,
} from "@/lib/copy";
import { readOriginal } from "@/lib/storage/files";
import { formatBytes, formatIso, shortHash } from "@/lib/utils";

export function EvidenceViewer() {
  const evidence = useWorkspace((s) => s.evidence.find((e) => e.id === s.selectedId) ?? null);
  const extraction = useWorkspace((s) => s.extractions.find((e) => e.evidenceId === s.selectedId) ?? null);
  const ingestBusy = useWorkspace((s) => s.ingestBusy);
  const ingestMessage = useWorkspace((s) => s.ingestMessage);
  const importFiles = useWorkspace((s) => s.importFiles);
  const setSection = useWorkspace((s) => s.setSection);
  const [dragOver, setDragOver] = useState(false);

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length) void importFiles(files);
  }

  return (
    <section
      className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {evidence ? (
        <>
          <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{evidence.originalName}</p>
              <p className="font-mono text-2xs text-muted-foreground">
                SHA-256 {shortHash(evidence.sha256, 10)} · {formatBytes(evidence.byteSize)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={evidence.status === "QUARANTINED" ? "danger" : "default"}>
                {enumLabel(EVIDENCE_STATUS_LABEL, evidence.status)}
              </Badge>
              <Select value={evidence.section} onValueChange={(v) => void setSection(evidence.id, v as EvidenceRecord["section"])}>
                <SelectTrigger className="h-8 w-44 text-2xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVIDENCE_SECTIONS.map((section) => (
                    <SelectItem key={section} value={section}>
                      {SECTION_LABEL[section]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </header>
          <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_16rem]">
            <PreviewPane evidence={evidence} extraction={extraction} />
            <aside className="hidden min-h-0 border-l border-border lg:block">
              <MetaPane evidence={evidence} extraction={extraction} />
            </aside>
          </div>
        </>
      ) : (
        <EmptyDrop ingestBusy={ingestBusy} ingestMessage={ingestMessage} />
      )}
      {dragOver ? (
        <div className="absolute inset-3 z-10 grid place-items-center rounded-lg border border-dashed border-accent/50 bg-background/80">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">Pustite súbor na vloženie</p>
        </div>
      ) : null}
    </section>
  );
}

function EmptyDrop({ ingestBusy, ingestMessage }: { ingestBusy: boolean; ingestMessage: string | null }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <p className="font-mono text-2xs tracking-widest text-accent uppercase">Prehliadač dôkazov</p>
      <h2 className="font-display text-xl tracking-tight">Presuňte súbory do pracoviska</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        PDF, obrázky, DOCX, RTF, Markdown, text, CSV, JSON, XML, HTML. Typ súboru sa určí podľa podpisu, nie
        podľa názvu. Spustiteľné súbory sa uložia do karantény.
      </p>
      {ingestBusy ? <p className="font-mono text-xs text-accent">{ingestMessage}</p> : null}
    </div>
  );
}

function PreviewPane({
  evidence,
  extraction,
}: {
  evidence: EvidenceRecord;
  extraction: ExtractionRecord | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    setUrl(null);
    setLoadError(null);
    void (async () => {
      try {
        const blob = await readOriginal(evidence.caseId, evidence.id);
        if (cancelled) return;
        if (!blob) {
          setLoadError("Pôvodné bajty sa v lokálnom úložisku nenašli.");
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        revoked = objectUrl;
        setUrl(objectUrl);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Náhľad sa nepodarilo zobraziť");
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [evidence.caseId, evidence.id]);

  if (evidence.status === "QUARANTINED") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <ShieldAlert className="size-8 text-destructive" />
        <h3 className="text-sm font-medium">V karanténe</h3>
        <p className="max-w-md text-sm text-muted-foreground">{evidence.quarantineReason}</p>
        <p className="font-mono text-2xs text-subtle">Originál je uložený v nezmenenej podobe. Nespracúva sa ani nespúšťa.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <FileWarning className="size-6 text-warn" />
        <p className="text-sm text-muted-foreground">{loadError}</p>
      </div>
    );
  }

  if (evidence.previewKind === "image" && url) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-elevated/40 p-4">
        <img
          src={url}
          alt={evidence.originalName}
          className="max-h-full max-w-full object-contain outline outline-1 -outline-offset-1 outline-foreground/10"
        />
      </div>
    );
  }

  if (evidence.previewKind === "pdf" && url) {
    return (
      <iframe title={evidence.originalName} src={url} className="min-h-0 flex-1 bg-elevated" sandbox="" />
    );
  }

  if ((evidence.previewKind === "text" || evidence.previewKind === "markdown") && extraction) {
    return (
      <ScrollArea className="min-h-0 flex-1">
        {evidence.previewKind === "markdown" ? (
          <MarkdownLite text={extraction.text} />
        ) : (
          <pre className="whitespace-pre-wrap p-5 font-mono text-xs leading-relaxed text-foreground/90">
            {extraction.text || "Text sa nepodarilo vytiahnuť."}
          </pre>
        )}
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock className="size-4" />
          <p className="text-sm">Pre tento formát zatiaľ nie je plnohodnotný prehliadač. Extrahovaný text a metadáta sú k dispozícii.</p>
        </div>
        <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/80">
          {extraction?.text || "Žiadny extrahovaný text."}
        </pre>
      </div>
    </ScrollArea>
  );
}

function MetaPane({
  evidence,
  extraction,
}: {
  evidence: EvidenceRecord;
  extraction: ExtractionRecord | null;
}) {
  const rows = useMemo(
    () => [
      ["Stav", enumLabel(EVIDENCE_STATUS_LABEL, evidence.status)],
      ["Dráha spracovania", enumLabel(LANE_LABEL, evidence.ingestLane)],
      ["Typ", enumLabel(KIND_LABEL, evidence.detectedKind)],
      ["Deklarovaný MIME", evidence.mime || "—"],
      ["Zistený MIME", evidence.detectedMime],
      [
        "Sekcia",
        `${enumLabel(SECTION_LABEL, evidence.section)} · ${enumLabel(SECTION_SOURCE_LABEL, evidence.sectionSource)}`,
      ],
      ["Vložené", formatIso(evidence.importedAt)],
      ["Pôvodná zmena", formatIso(evidence.originalLastModified ?? undefined)],
      ["SHA-256", evidence.sha256],
      ["Úložisko", evidence.storagePath],
      ["Slová", extraction ? String(extraction.wordCount) : "—"],
      ["Spracovanie", extraction ? `${extraction.processor} ${extraction.processorVersion}` : "—"],
      ["Strany", extraction?.pageCount != null ? String(extraction.pageCount) : "—"],
    ],
    [evidence, extraction],
  );

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        <p className="font-mono text-2xs tracking-widest text-muted-foreground uppercase">Originál / nemenné</p>
        <dl className="space-y-3">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-2xs tracking-wide text-subtle uppercase">{k}</dt>
              <dd className="mt-1 break-all font-mono text-2xs leading-relaxed">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </ScrollArea>
  );
}

function MarkdownLite({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <article className="space-y-3 p-5 text-sm leading-relaxed">
      {blocks.map((block, i) => {
        const line = block.trim();
        if (!line) return null;
        if (line.startsWith("### "))
          return (
            <h3 key={i} className="text-sm font-medium">
              {line.slice(4)}
            </h3>
          );
        if (line.startsWith("## "))
          return (
            <h2 key={i} className="text-base font-medium">
              {line.slice(3)}
            </h2>
          );
        if (line.startsWith("# "))
          return (
            <h1 key={i} className="text-lg font-medium">
              {line.slice(2)}
            </h1>
          );
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 text-muted-foreground">
              {line.split("\n").map((item, j) => (
                <li key={j}>{item.replace(/^[-*]\s+/, "")}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap text-foreground/90">
            {line}
          </p>
        );
      })}
    </article>
  );
}
