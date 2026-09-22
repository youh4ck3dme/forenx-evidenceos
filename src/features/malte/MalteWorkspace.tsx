import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createId } from "@/lib/ids";
import { cn, formatIso } from "@/lib/utils";
import {
  localAlertRepository,
  localCaseRepository,
  localDetectionConfigRepository,
  localRelationshipRepository,
  localSubjectRepository,
  localTransactionRepository,
} from "@/lib/storage/repositories";
import { appendAuditChained } from "@/lib/storage/auditChain";
import type {
  AlertRecord,
  AlertSeverity,
  AlertStatus,
  DetectionWeights,
  RelationshipRecord,
  SubjectRecord,
  TransactionRecord,
} from "@/domain/types";
import { ImportWizard } from "@/features/malte/import/ImportWizard";
import {
  ensureDetectionConfig,
  runMalteDetection,
  updateDetectionWeights,
} from "@/features/malte/detection/engine";
import { findSubjectPath, NetworkGraph } from "@/features/malte/graph/NetworkGraph";
import { exportMaltePdfReport } from "@/features/malte/report/exportPdfReport";
import { DEFAULT_WEIGHTS } from "@/features/malte/detection/defaults";

type MalteView = "alerts" | "import" | "graph" | "weights";

const SEVERITIES: AlertSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const STATUSES: AlertStatus[] = ["NEW", "REVIEWED", "FALSE_POSITIVE", "ESCALATED"];

export function MalteWorkspace({ caseId, workspaceId }: { caseId: string; workspaceId: string }) {
  const [view, setView] = useState<MalteView>("alerts");
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [relationships, setRelationships] = useState<RelationshipRecord[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<AlertStatus | "ALL">("ALL");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [weights, setWeights] = useState<DetectionWeights>({ ...DEFAULT_WEIGHTS });
  const [pathFrom, setPathFrom] = useState<string>("");
  const [pathTo, setPathTo] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [a, s, t, r, cfg] = await Promise.all([
      localAlertRepository.listByCase(caseId),
      localSubjectRepository.listByCase(caseId),
      localTransactionRepository.listByCase(caseId),
      localRelationshipRepository.listByCase(caseId),
      ensureDetectionConfig(caseId, workspaceId),
    ]);
    setAlerts(a);
    setSubjects(s);
    setTransactions(t);
    setRelationships(r);
    setWeights({ ...cfg.weights });
  }, [caseId, workspaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (severityFilter !== "ALL" && a.severity !== severityFilter) return false;
      if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
      return true;
    });
  }, [alerts, severityFilter, statusFilter]);

  const selected = alerts.find((a) => a.id === selectedAlertId) ?? filtered[0] ?? null;

  const highlightPath = useMemo(() => {
    if (!pathFrom || !pathTo) return selected?.subjectIds ?? [];
    return findSubjectPath(relationships, pathFrom, pathTo);
  }, [pathFrom, pathTo, relationships, selected]);

  async function runDetection() {
    setBusy(true);
    setStatusMsg(null);
    try {
      const result = await runMalteDetection(caseId, workspaceId);
      await reload();
      setStatusMsg(
        `Detection complete: ${result.alerts.length} alerts · rule ${result.alerts[0]?.ruleVersion ?? "v1"}`,
      );
      setView("alerts");
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function reviewAlert(status: AlertStatus) {
    if (!selected) return;
    const now = new Date().toISOString();
    await localAlertRepository.update(selected.id, {
      status,
      reviewedAt: now,
      reviewedBy: "local-analyst",
    });
    await appendAuditChained({
      id: createId("audit"),
      caseId,
      workspaceId,
      type: "MALTE_ALERT_REVIEWED",
      createdAt: now,
      message: `Alert ${selected.id} → ${status}`,
      meta: {
        alertId: selected.id,
        status,
        ruleVersion: selected.ruleVersion,
        score: selected.score,
      },
    });
    await reload();
    setSelectedAlertId(selected.id);
  }

  async function saveWeights() {
    setBusy(true);
    try {
      await updateDetectionWeights(caseId, workspaceId, weights);
      setStatusMsg("Weights saved (audited).");
    } finally {
      setBusy(false);
    }
  }

  async function exportPdf() {
    setBusy(true);
    try {
      const caseRecord = await localCaseRepository.get(caseId);
      if (!caseRecord) throw new Error("Case not found");
      const config = await localDetectionConfigRepository.getByCase(caseId);
      await exportMaltePdfReport({
        caseRecord,
        alerts,
        subjects,
        transactions,
        config: config ?? null,
        workspaceId,
      });
      setStatusMsg("PDF report downloaded.");
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (view === "import") {
    return (
      <ImportWizard
        caseId={caseId}
        workspaceId={workspaceId}
        onCancel={() => setView("alerts")}
        onDone={(count) => {
          setStatusMsg(`Imported ${count} transactions.`);
          setView("alerts");
          void reload();
        }}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="mr-auto">
          <div className="font-mono text-[10px] tracking-[0.2em] text-subtle uppercase">
            Malte triage
          </div>
          <div className="text-xs text-muted-foreground">
            {transactions.length} tx · {subjects.length} subjects · {alerts.length} alerts
          </div>
        </div>
        {(
          [
            ["alerts", "Alerts"],
            ["graph", "Graph"],
            ["weights", "Weights"],
            ["import", "Import"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={view === id ? "default" : "secondary"}
            onClick={() => setView(id)}
          >
            {label}
          </Button>
        ))}
        <Button
          size="sm"
          disabled={busy || !transactions.length}
          onClick={() => void runDetection()}
        >
          Run detection
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void exportPdf()}>
          PDF report
        </Button>
      </header>

      {statusMsg && (
        <div className="border-b border-border px-3 py-1.5 font-mono text-[11px] text-accent">
          {statusMsg}
        </div>
      )}

      {view === "weights" && (
        <ScrollArea className="min-h-0 flex-1 p-4">
          <h3 className="text-sm font-semibold text-foreground">Configurable rule weights</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Changes are audited with ruleVersion. Re-run detection to apply.
          </p>
          <div className="mt-4 grid max-w-lg gap-3">
            {(Object.keys(weights) as (keyof DetectionWeights)[]).map((key) => (
              <label key={key} className="flex items-center justify-between gap-3 text-xs">
                <span className="font-mono text-muted-foreground">{key}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="w-24 rounded-sm border border-border bg-elevated px-2 py-1 text-foreground"
                  value={weights[key]}
                  onChange={(e) =>
                    setWeights((w) => ({ ...w, [key]: Number(e.target.value) || 0 }))
                  }
                />
              </label>
            ))}
            <Button disabled={busy} onClick={() => void saveWeights()}>
              Save weights
            </Button>
          </div>
        </ScrollArea>
      )}

      {view === "graph" && (
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <select
              className="rounded-sm border border-border bg-elevated px-2 py-1 text-foreground"
              value={pathFrom}
              onChange={(e) => setPathFrom(e.target.value)}
            >
              <option value="">Path from…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-sm border border-border bg-elevated px-2 py-1 text-foreground"
              value={pathTo}
              onChange={(e) => setPathTo(e.target.value)}
            >
              <option value="">Path to…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {highlightPath.length > 0 && pathFrom && pathTo && (
              <span className="text-muted-foreground">
                Path length: {Math.max(0, highlightPath.length - 1)} hops
              </span>
            )}
          </div>
          <NetworkGraph
            subjects={subjects}
            relationships={relationships}
            highlightPath={highlightPath}
            selectedId={selectedSubjectId}
            onSelect={setSelectedSubjectId}
          />
          {selectedSubjectId && subjects.some((s) => s.id === selectedSubjectId) && (
            <SubjectCard
              subject={subjects.find((s) => s.id === selectedSubjectId)!}
              txs={transactions.filter(
                (t) => t.fromSubjectId === selectedSubjectId || t.toSubjectId === selectedSubjectId,
              )}
            />
          )}
        </div>
      )}

      {view === "alerts" && (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex w-full min-w-0 flex-col border-r border-border md:w-[42%]">
            <div className="flex gap-2 border-b border-border p-2">
              <select
                className="flex-1 rounded-sm border border-border bg-elevated px-2 py-1 text-xs text-foreground"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as AlertSeverity | "ALL")}
              >
                <option value="ALL">All severities</option>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="flex-1 rounded-sm border border-border bg-elevated px-2 py-1 text-xs text-foreground"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as AlertStatus | "ALL")}
              >
                <option value="ALL">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              {filtered.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground">
                  No alerts yet. Import a statement, then run detection.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {filtered.map((alert) => (
                    <li key={alert.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-elevated",
                          selected?.id === alert.id && "bg-elevated",
                        )}
                        onClick={() => setSelectedAlertId(alert.id)}
                      >
                        <div className="flex items-center gap-2">
                          <SeverityChip severity={alert.severity} />
                          <span className="font-mono text-[10px] text-subtle">
                            {alert.score}/100
                          </span>
                          <span className="ml-auto font-mono text-[10px] text-subtle">
                            {alert.obsolete ? `${alert.status} · obsolete` : alert.status}
                          </span>
                        </div>
                        <div className="text-xs font-medium text-foreground">{alert.title}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>

          <ScrollArea className="hidden min-h-0 flex-1 md:block">
            {selected ? (
              <div className="space-y-4 p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityChip severity={selected.severity} />
                    <span className="font-mono text-sm text-accent">{selected.score}/100</span>
                    <span className="font-mono text-[10px] text-subtle">
                      {selected.ruleId} · {selected.ruleVersion}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-foreground">{selected.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{selected.description}</p>
                  <p className="mt-1 font-mono text-[10px] text-subtle">
                    {formatIso(selected.createdAt)}
                  </p>
                </div>

                <div>
                  <h4 className="font-mono text-[10px] tracking-wider text-subtle uppercase">
                    Score breakdown
                  </h4>
                  <ul className="mt-2 space-y-2">
                    {selected.factors.map((f, i) => (
                      <li
                        key={`${f.code}-${i}`}
                        className="rounded-sm border border-border bg-surface px-3 py-2"
                      >
                        <div className="flex justify-between gap-2 text-xs">
                          <span className="font-medium text-foreground">{f.label}</span>
                          <span className="shrink-0 font-mono text-accent">
                            +{f.contribution.toFixed(1)}
                          </span>
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-subtle">
                          {f.code} · weight {f.weight.toFixed(1)}
                          {f.sourceRow != null ? ` · source row ${f.sourceRow}` : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void reviewAlert("REVIEWED")}>
                    Mark reviewed
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void reviewAlert("FALSE_POSITIVE")}
                  >
                    False positive
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void reviewAlert("ESCALATED")}
                  >
                    Escalate
                  </Button>
                </div>

                {selected.transactionIds.length > 0 && (
                  <TxList
                    items={transactions.filter((t) => selected.transactionIds.includes(t.id))}
                  />
                )}
              </div>
            ) : (
              <p className="p-4 text-xs text-muted-foreground">
                Select an alert to see score factors.
              </p>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

function SeverityChip({ severity }: { severity: AlertSeverity }) {
  const color =
    severity === "CRITICAL"
      ? "text-destructive border-destructive/40"
      : severity === "HIGH"
        ? "text-warn border-warn/40"
        : severity === "MEDIUM"
          ? "text-accent border-accent/40"
          : "text-muted-foreground border-border";
  return (
    <span className={cn("rounded-sm border px-1.5 py-0.5 font-mono text-[10px]", color)}>
      {severity}
    </span>
  );
}

function SubjectCard({ subject, txs }: { subject: SubjectRecord; txs: TransactionRecord[] }) {
  return (
    <div className="rounded-sm border border-border bg-surface p-3 text-xs">
      <div className="font-semibold text-foreground">
        {subject.name}{" "}
        <span className="font-mono text-subtle">
          {subject.kind} · {subject.riskScore}/100
        </span>
      </div>
      <TxList items={txs.slice(0, 8)} />
    </div>
  );
}

function TxList({ items }: { items: TransactionRecord[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="font-mono text-[10px] tracking-wider text-subtle uppercase">
        Linked transactions
      </h4>
      <ul className="mt-1 space-y-1">
        {items.map((t) => (
          <li key={t.id} className="font-mono text-[11px] text-muted-foreground">
            {t.bookedAt.slice(0, 10)} · {t.amount} {t.currency} · {t.fromLabel} → {t.toLabel}
            {t.sourceRow != null ? ` · row ${t.sourceRow}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
