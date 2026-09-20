import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { CLASSIFICATIONS, type Classification } from "@/domain/types";
import { selectActiveCase, useWorkspace } from "@/features/workspace/store";
import { AUDIT_TYPE_LABEL, CLASSIFICATION_LABEL, enumLabel, skCount } from "@/lib/copy";
import { formatIso } from "@/lib/utils";

export function WorkspaceDialogs() {
  return (
    <>
      <CreateCaseDialog />
      <AiConfirmDialog />
      <AuditDrawer />
    </>
  );
}

function CreateCaseDialog() {
  const open = useWorkspace((s) => s.createCaseOpen);
  const setOpen = useWorkspace((s) => s.setCreateCaseOpen);
  const createCase = useWorkspace((s) => s.createCase);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [classification, setClassification] = useState<Classification>("CONFIDENTIAL");
  const [tags, setTags] = useState("");

  async function submit() {
    await createCase({
      name,
      description,
      classification,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setName("");
    setDescription("");
    setTags("");
    setClassification("CONFIDENTIAL");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nový lokálny prípad</DialogTitle>
          <DialogDescription>Uloží sa len v tomto prehliadači. Účet nie je potrebný.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="case-name">Názov</Label>
            <Input
              id="case-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Názov vyšetrovania"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Klasifikácia</Label>
            <Select value={classification} onValueChange={(v) => setClassification(v as Classification)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLASSIFICATIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CLASSIFICATION_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="case-desc">Popis</Label>
            <Textarea id="case-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="case-tags">Značky</Label>
            <Input
              id="case-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="oddelené čiarkou"
            />
          </div>
          <Button onClick={() => void submit()}>Vytvoriť prípad</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AiConfirmDialog() {
  const action = useWorkspace((s) => s.pendingAction);
  const cancel = useWorkspace((s) => s.cancelAction);
  const confirm = useWorkspace((s) => s.confirmAction);
  const evidence = useWorkspace((s) => s.evidence);
  const selectedIds = useWorkspace((s) => s.selectedIds);
  const extractions = useWorkspace((s) => s.extractions);
  const active = useWorkspace(selectActiveCase);

  const ids =
    action && (action.id === "case-report" || action.id === "evidence-gaps" || action.id === "investigator-questions")
      ? evidence.map((e) => e.id)
      : selectedIds;
  const items = evidence.filter((e) => ids.includes(e.id)).slice(0, 6);
  const chars = items.reduce((sum, item) => sum + (extractions.find((x) => x.evidenceId === item.id)?.text.length ?? 0), 0);

  return (
    <Dialog open={Boolean(action)} onOpenChange={(open) => !open && cancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{action ? `${action.number} ${action.name}` : "Potvrdiť analýzu"}</DialogTitle>
          <DialogDescription>
            Na AI službu sa odošle extrahovaný text a metadáta z parsera. Pôvodné súbory ostávajú v tomto
            zariadení a neodosielajú sa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Prípad {active?.reference} · {skCount(items.length, "dôkaz", "dôkazy", "dôkazov")} ·{" "}
            {chars.toLocaleString("sk-SK")} extrahovaných znakov (na položku je limit).
          </p>
          <ul className="max-h-40 space-y-1 overflow-auto font-mono text-2xs text-muted-foreground">
            {items.map((item) => (
              <li key={item.id}>{item.originalName}</li>
            ))}
            {ids.length > 6 ? <li>…a ešte {ids.length - 6}</li> : null}
          </ul>
          <p className="text-xs text-subtle">{action?.description}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={cancel}>
              Zrušiť
            </Button>
            <Button onClick={() => void confirm()} disabled={items.length === 0 && action?.requiredInputs.includes("evidence")}>
              Odoslať odvodený text
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AuditDrawer() {
  const open = useWorkspace((s) => s.auditOpen);
  const setOpen = useWorkspace((s) => s.setAuditOpen);
  const audit = useWorkspace((s) => s.audit);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Záznam udalostí</SheetTitle>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <ul className="space-y-3 p-4">
            {audit.length === 0 ? <li className="text-sm text-muted-foreground">Zatiaľ žiadne udalosti.</li> : null}
            {audit.map((event) => (
              <li key={event.id} className="border-b border-border pb-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge>{enumLabel(AUDIT_TYPE_LABEL, event.type)}</Badge>
                  <span className="font-mono text-2xs text-subtle">{formatIso(event.createdAt)}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed">{event.message}</p>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
