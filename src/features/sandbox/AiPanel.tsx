import { Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { AiAvailability } from "@/domain/types";
import { FORENSIC_ACTIONS, getAction } from "@/lib/ai/actions";
import { useWorkspace } from "@/features/workspace/store";
import { EPISTEMIC_LABEL, REVIEW_LABEL, RUN_STATUS_LABEL, enumLabel, skCount } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function AiPanel() {
  const availability = useWorkspace((s) => s.aiAvailability);
  const requestAction = useWorkspace((s) => s.requestAction);
  const findingsAll = useWorkspace((s) => s.findings);
  const reviewFinding = useWorkspace((s) => s.reviewFinding);
  const runsAll = useWorkspace((s) => s.aiRuns);
  const selectedCount = useWorkspace((s) => s.selectedIds.length);
  const disabled = availability !== "LIVE";
  const findings = findingsAll.slice(0, 12);
  const runs = runsAll.slice(0, 8);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex h-11 items-center justify-between border-b border-border px-3">
        <p className="font-mono text-2xs tracking-widest uppercase">ForenX AI</p>
        <AiStatus availability={availability} />
      </div>
      <div className="border-b border-border px-3 py-2">
        <p className="text-2xs text-muted-foreground">
          {selectedCount === 0
            ? "Nie je vybraný žiadny dôkaz. Úkony na úrovni prípadu pracujú s celým zoznamom."
            : `${skCount(selectedCount, "vybraná položka", "vybrané položky", "vybraných položiek")}. Odosiela sa len extrahovaný text.`}
        </p>
      </div>
      <ScrollArea className="h-56 shrink-0 border-b border-border">
        <div className="grid grid-cols-1 gap-px p-2">
          {FORENSIC_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={disabled}
              onClick={() => requestAction(action.id)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-elevated disabled:opacity-40"
            >
              <span className="w-6 font-mono text-2xs text-subtle">{action.number}</span>
              <span className="flex-1 text-xs">{action.name}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
      <div className="flex min-h-0 flex-1 flex-col">
        <p className="px-3 py-2 font-mono text-2xs tracking-widest text-subtle uppercase">Zistenia</p>
        <ScrollArea className="min-h-0 flex-1">
          {findings.length === 0 ? (
            <p className="px-3 text-xs text-muted-foreground">Zatiaľ nie sú žiadne zistenia z AI.</p>
          ) : (
            <ul className="space-y-2 px-2 pb-3">
              {findings.map((finding) => (
                <li key={finding.id} className="rounded-md border border-border p-2">
                  <p className="font-mono text-2xs text-accent">
                    {enumLabel(EPISTEMIC_LABEL, finding.epistemicClass)} · {finding.confidence.toFixed(2)} ·{" "}
                    {enumLabel(REVIEW_LABEL, finding.reviewStatus)}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">{finding.statement}</p>
                  {finding.sourceReferences[0] ? (
                    <p className="mt-1 font-mono text-2xs text-subtle">{finding.sourceReferences[0].fileName}</p>
                  ) : null}
                  <div className="mt-2 flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-2xs" onClick={() => void reviewFinding(finding.id, "ACCEPTED")}>
                      Prijať
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-2xs" onClick={() => void reviewFinding(finding.id, "REJECTED")}>
                      Odmietnuť
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <Separator />
        <div className="p-3">
          <p className="mb-2 font-mono text-2xs tracking-widest text-subtle uppercase">História analýz</p>
          <ul className="space-y-1">
            {runs.length === 0 ? <li className="text-2xs text-muted-foreground">Prázdna</li> : null}
            {runs.map((run) => (
              <li key={run.id} className="flex items-center justify-between gap-2 font-mono text-2xs">
                <span className="truncate">{getAction(run.actionId)?.shortName ?? run.actionId}</span>
                <span className={cn(run.status === "FAILED" ? "text-destructive" : "text-subtle")}>
                  {enumLabel(RUN_STATUS_LABEL, run.status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const AI_STATUS: Record<
  AiAvailability,
  { label: string; variant: "live" | "warn" | "danger"; pulse: boolean }
> = {
  LIVE: { label: "Mistral pripojené", variant: "live", pulse: true },
  RUNNING: { label: "Prebieha analýza", variant: "live", pulse: true },
  OFFLINE: { label: "Bez pripojenia", variant: "warn", pulse: false },
  UNAVAILABLE: { label: "Mistral nedostupné", variant: "danger", pulse: false },
};

function AiStatus({ availability }: { availability: AiAvailability }) {
  const item = AI_STATUS[availability];
  return (
    <Badge variant={item.variant} className="gap-1.5">
      <Circle className={cn("size-2 fill-current", item.pulse && "animate-pulse")} />
      {item.label}
    </Badge>
  );
}
