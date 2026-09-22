import { Menu, ScanSearch, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AiPanel } from "@/features/sandbox/AiPanel";
import { CommandPalette } from "@/features/sandbox/CommandPalette";
import { LeftSidebar } from "@/features/sandbox/LeftSidebar";
import { StatusBar } from "@/features/sandbox/StatusBar";
import { WorkspaceDialogs } from "@/features/sandbox/WorkspaceDialogs";
import { MalteWorkspace } from "@/features/malte/MalteWorkspace";
import { EvidenceViewer } from "@/features/viewer/EvidenceViewer";
import { selectActiveCase, useWorkspace } from "@/features/workspace/store";
import { WORKSPACE_ID } from "@/domain/types";
import { extraTopInsetPx, readViewportFlags } from "@/lib/viewport";

export function SandboxShell() {
  const hydrate = useWorkspace((s) => s.hydrate);
  const enterSandbox = useWorkspace((s) => s.enterSandbox);
  const pingAi = useWorkspace((s) => s.pingAi);
  const active = useWorkspace(selectActiveCase);
  const workspaceMode = useWorkspace((s) => s.workspaceMode);
  const activeCaseId = useWorkspace((s) => s.activeCaseId);
  const showMalte = workspaceMode === "malte" && Boolean(activeCaseId);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [chromeInset, setChromeInset] = useState(0);

  useEffect(() => {
    void (async () => {
      if (!useWorkspace.getState().hydrated) await hydrate();
      await enterSandbox();
    })();
  }, [enterSandbox, hydrate]);

  useEffect(() => {
    function onOnline() {
      void pingAi();
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
    };
  }, [pingAi]);

  useEffect(() => {
    function sync() {
      setChromeInset(extraTopInsetPx(readViewportFlags()));
    }
    sync();
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (active?.reference) {
      document.title = `${active.reference} · ForenX`;
    }
  }, [active?.reference, active?.name]);

  return (
    <div
      className="flex h-full max-h-full w-full min-h-0 flex-col overflow-hidden bg-background text-foreground"
      style={chromeInset ? { paddingTop: chromeInset } : undefined}
    >
      <header className="flex min-h-11 w-full shrink-0 items-center gap-2 border-b border-border bg-surface px-2 pt-[env(safe-area-inset-top,0px)] lg:hidden">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => {
            setRightOpen(false);
            setLeftOpen((v) => !v);
          }}
          aria-label={leftOpen ? "Zavrieť panel prípadu" : "Otvoriť panel prípadu"}
          aria-pressed={leftOpen}
        >
          {leftOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-2xs tracking-widest text-accent uppercase">
            {active?.reference}
          </p>
          <p className="truncate text-xs">{active?.name}</p>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => {
            setLeftOpen(false);
            setRightOpen((v) => !v);
          }}
          aria-label={rightOpen ? "Zavrieť panel AI" : "Otvoriť panel AI"}
          aria-pressed={rightOpen}
        >
          {rightOpen ? <X className="size-4" /> : <ScanSearch className="size-4" />}
        </Button>
      </header>

      <div className="relative flex min-h-0 w-full flex-1 overflow-hidden">
        <aside className="hidden h-full w-64 shrink-0 border-r border-border lg:block">
          <LeftSidebar />
        </aside>
        {showMalte && activeCaseId ? (
          <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <MalteWorkspace
              caseId={activeCaseId}
              workspaceId={active?.workspaceId ?? WORKSPACE_ID}
            />
          </main>
        ) : (
          <EvidenceViewer />
        )}
        {showMalte ? null : (
          <aside className="hidden h-full w-80 shrink-0 border-l border-border xl:block">
            <AiPanel />
          </aside>
        )}

        <MobilePanel open={leftOpen} title="Prípad" onClose={() => setLeftOpen(false)}>
          <LeftSidebar
            onEvidencePicked={() => setLeftOpen(false)}
            onOpenAi={() => {
              setLeftOpen(false);
              setRightOpen(true);
            }}
          />
        </MobilePanel>
        <MobilePanel
          open={rightOpen}
          title={showMalte ? "Malte" : "ForenX AI"}
          onClose={() => setRightOpen(false)}
        >
          {showMalte && activeCaseId ? (
            <MalteWorkspace
              caseId={activeCaseId}
              workspaceId={active?.workspaceId ?? WORKSPACE_ID}
            />
          ) : (
            <AiPanel />
          )}
        </MobilePanel>
      </div>
      <StatusBar />
      <CommandPalette />
      <WorkspaceDialogs />
    </div>
  );
}

function MobilePanel({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="absolute inset-0 z-30 flex flex-col bg-surface lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <p className="font-mono text-2xs tracking-widest uppercase">{title}</p>
        <Button size="sm" variant="ghost" className="h-9 px-3" onClick={onClose}>
          Zavrieť
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
