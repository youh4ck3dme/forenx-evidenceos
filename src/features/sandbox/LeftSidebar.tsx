import { FileSearch, Files, ListTree, Plus, ScrollText, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { EvidenceRecord } from "@/domain/types";
import { selectActiveCase, useWorkspace, type LeftView } from "@/features/workspace/store";
import {
  CLASSIFICATION_LABEL,
  ENTITY_TYPE_LABEL,
  EPISTEMIC_LABEL,
  EVIDENCE_STATUS_LABEL,
  RUN_STATUS_LABEL,
  SECTION_LABEL,
  enumLabel,
} from "@/lib/copy";
import { cn, formatClock, shortHash } from "@/lib/utils";

const NAV: Array<{ id: LeftView; label: string; icon: typeof Files }> = [
  { id: "evidence", label: "Dôkazy", icon: Files },
  { id: "timeline", label: "Časová os", icon: ListTree },
  { id: "entities", label: "Entity", icon: Users },
  { id: "findings", label: "Zistenia", icon: FileSearch },
  { id: "reports", label: "Správy", icon: ScrollText },
];

export function LeftSidebar() {
  const active = useWorkspace(selectActiveCase);
  const cases = useWorkspace((s) => s.cases);
  const setActiveCase = useWorkspace((s) => s.setActiveCase);
  const setCreateCaseOpen = useWorkspace((s) => s.setCreateCaseOpen);
  const leftView = useWorkspace((s) => s.leftView);
  const setLeftView = useWorkspace((s) => s.setLeftView);
  const searchQuery = useWorkspace((s) => s.searchQuery);
  const setSearchQuery = useWorkspace((s) => s.setSearchQuery);
  const evidence = useWorkspace((s) => s.evidence);
  const findings = useWorkspace((s) => s.findings);
  const entities = useWorkspace((s) => s.entities);
  const timeline = useWorkspace((s) => s.timeline);
  const reportCount = useWorkspace((s) => s.aiRuns.filter((r) => r.actionId === "case-report").length);
  const selectedId = useWorkspace((s) => s.selectedId);
  const selectEvidence = useWorkspace((s) => s.selectEvidence);

  const counts: Record<LeftView, number> = {
    evidence: evidence.length,
    timeline: timeline.length,
    entities: entities.length,
    findings: findings.length,
    reports: reportCount,
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="border-b border-border px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-2xs tracking-widest text-accent uppercase">{active?.reference ?? "—"}</p>
            <h2 className="truncate text-sm font-medium">{active?.name ?? "Žiadny prípad"}</h2>
          </div>
          <Button size="icon-sm" variant="outline" onClick={() => setCreateCaseOpen(true)} aria-label="Vytvoriť prípad">
            <Plus className="size-3.5" />
          </Button>
        </div>
        {active ? (
          <div className="mt-2 flex items-center gap-2">
            <Badge>{CLASSIFICATION_LABEL[active.classification]}</Badge>
            <span className="text-2xs text-subtle">{formatClock(active.updatedAt)}</span>
          </div>
        ) : null}
        {cases.length > 1 ? (
          <select
            className="mt-3 h-8 w-full rounded-md border border-border bg-elevated px-2 font-mono text-2xs"
            value={active?.id}
            onChange={(e) => void setActiveCase(e.target.value)}
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.reference} · {c.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="px-3 py-2">
        <Input
          data-search="evidence"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Hľadať súbory, text, entity…"
          className="h-8 text-xs"
        />
      </div>

      <nav className="grid grid-cols-1 gap-px px-2 pb-2">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setLeftView(item.id)}
            className={cn(
              "flex h-9 items-center justify-between rounded-md px-2 text-xs",
              leftView === item.id ? "bg-elevated text-foreground" : "text-muted-foreground hover:bg-elevated/60",
            )}
          >
            <span className="flex items-center gap-2">
              <item.icon className="size-3.5" />
              {item.label}
            </span>
            <span className="font-mono text-2xs tabular-nums text-subtle">{counts[item.id]}</span>
          </button>
        ))}
      </nav>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        {leftView === "evidence" ? (
          <EvidenceList
            evidence={evidence}
            selectedId={selectedId}
            query={searchQuery}
            onSelect={(id, additive) => selectEvidence(id, additive)}
          />
        ) : null}
        {leftView === "timeline" ? <TimelineList query={searchQuery} /> : null}
        {leftView === "entities" ? <EntityList query={searchQuery} /> : null}
        {leftView === "findings" ? <FindingList query={searchQuery} /> : null}
        {leftView === "reports" ? <ReportList /> : null}
      </ScrollArea>
    </div>
  );
}

function EvidenceList({
  evidence,
  selectedId,
  query,
  onSelect,
}: {
  evidence: EvidenceRecord[];
  selectedId: string | null;
  query: string;
  onSelect: (id: string, additive?: boolean) => void;
}) {
  const extractions = useWorkspace((s) => s.extractions);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? evidence.filter((item) => {
        const text = extractions.find((e) => e.evidenceId === item.id)?.text ?? "";
        return (
          item.originalName.toLowerCase().includes(q) ||
          item.sha256.includes(q) ||
          item.section.toLowerCase().includes(q) ||
          enumLabel(SECTION_LABEL, item.section).toLowerCase().includes(q) ||
          text.toLowerCase().includes(q)
        );
      })
    : evidence;

  const grouped = new Map<string, EvidenceRecord[]>();
  for (const item of filtered) {
    const list = grouped.get(item.section) ?? [];
    list.push(item);
    grouped.set(item.section, list);
  }

  if (filtered.length === 0) {
    return <p className="px-4 py-8 text-center text-xs text-muted-foreground">V tomto prípade zatiaľ nie sú žiadne dôkazy.</p>;
  }

  return (
    <div className="py-2">
      {Array.from(grouped.entries()).map(([section, items]) => (
        <div key={section} className="mb-3">
          <p className="px-3 pb-1 font-mono text-2xs tracking-widest text-subtle uppercase">
            {enumLabel(SECTION_LABEL, section)} · {items.length}
          </p>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={(e) => onSelect(item.id, e.metaKey || e.ctrlKey)}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left",
                selectedId === item.id ? "bg-elevated" : "hover:bg-elevated/50",
              )}
            >
              <span className="w-full truncate text-xs">{item.originalName}</span>
              <span className="font-mono text-2xs text-subtle">
                {shortHash(item.sha256, 6)} · {enumLabel(EVIDENCE_STATUS_LABEL, item.status)}
                {item.duplicateOf ? " · duplikát" : ""}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function TimelineList({ query }: { query: string }) {
  const events = useWorkspace((s) => s.timeline);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? events.filter((e) => `${e.action} ${e.timestampOriginal} ${e.actors.join(" ")}`.toLowerCase().includes(q))
    : events;
  const sorted = [...filtered].sort((a, b) =>
    (a.timestampNormalized ?? a.timestampOriginal).localeCompare(b.timestampNormalized ?? b.timestampOriginal),
  );
  if (!sorted.length) return <Empty label="Časová os je zatiaľ prázdna." />;
  return (
    <ul className="space-y-3 p-3">
      {sorted.map((event) => (
        <li key={event.id} className="border-l border-border pl-3">
          <p className="font-mono text-2xs text-accent">{event.timestampOriginal}</p>
          <p className="text-xs">{event.action}</p>
          <p className="text-2xs text-subtle">{event.actors.join(", ") || event.eventType}</p>
        </li>
      ))}
    </ul>
  );
}

function EntityList({ query }: { query: string }) {
  const entities = useWorkspace((s) => s.entities);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? entities.filter((e) => `${e.canonicalValue} ${e.entityType} ${e.aliases.join(" ")}`.toLowerCase().includes(q))
    : entities;
  if (!filtered.length) return <Empty label="Zatiaľ neboli vytiahnuté žiadne entity." />;
  return (
    <ul className="divide-y divide-border">
      {filtered.map((entity) => (
        <li key={entity.id} className="px-3 py-2">
          <p className="text-xs">{entity.canonicalValue}</p>
          <p className="font-mono text-2xs text-subtle">{enumLabel(ENTITY_TYPE_LABEL, entity.entityType)}</p>
        </li>
      ))}
    </ul>
  );
}

function FindingList({ query }: { query: string }) {
  const findings = useWorkspace((s) => s.findings);
  const q = query.trim().toLowerCase();
  const filtered = q ? findings.filter((f) => f.statement.toLowerCase().includes(q)) : findings;
  if (!filtered.length) return <Empty label="Zatiaľ nie sú žiadne zistenia." />;
  return (
    <ul className="space-y-2 p-2">
      {filtered.map((finding) => (
        <li key={finding.id} className="rounded-md border border-border p-2">
          <p className="font-mono text-2xs text-accent">
            {enumLabel(EPISTEMIC_LABEL, finding.epistemicClass)} · {finding.confidence.toFixed(2)}
          </p>
          <p className="mt-1 text-xs leading-relaxed">{finding.statement}</p>
        </li>
      ))}
    </ul>
  );
}

function ReportList() {
  const aiRuns = useWorkspace((s) => s.aiRuns);
  const exportCase = useWorkspace((s) => s.exportCase);
  const runs = aiRuns.filter((r) => r.actionId === "case-report");
  if (!runs.length) {
    return (
      <div className="space-y-3 p-4">
        <Empty label="Zatiaľ nie je žiadna správa o prípade. Spustite ju v paneli AI." />
        <Button variant="outline" size="sm" className="w-full" onClick={() => void exportCase("markdown")}>
          Exportovať zoznam dôkazov (Markdown)
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-3 p-3">
      {runs.map((run) => (
        <article key={run.id} className="rounded-md border border-border p-3">
          <p className="font-mono text-2xs text-accent">{enumLabel(RUN_STATUS_LABEL, run.status)}</p>
          <p className="mt-1 text-xs">{run.summary || "Správa o prípade"}</p>
          <p className="mt-2 font-mono text-2xs text-subtle">
            {run.model ?? "—"} · {run.promptVersion}
          </p>
        </article>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => void exportCase("markdown")}>
        Exportovať Markdown
      </Button>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="px-4 py-8 text-center text-xs text-muted-foreground">{label}</p>;
}
