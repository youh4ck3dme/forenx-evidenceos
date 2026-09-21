import { Menu, ScanSearch } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AiPanel } from "@/features/sandbox/AiPanel";
import { CommandPalette } from "@/features/sandbox/CommandPalette";
import { LeftSidebar } from "@/features/sandbox/LeftSidebar";
import { StatusBar } from "@/features/sandbox/StatusBar";
import { WorkspaceDialogs } from "@/features/sandbox/WorkspaceDialogs";
import { EvidenceViewer } from "@/features/viewer/EvidenceViewer";
import { useWorkspace } from "@/features/workspace/store";
import { selectActiveCase } from "@/features/workspace/store";

export function SandboxShell() {
  const hydrate = useWorkspace((s) => s.hydrate);
  const enterSandbox = useWorkspace((s) => s.enterSandbox);
  const pingAi = useWorkspace((s) => s.pingAi);
  const active = useWorkspace(selectActiveCase);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

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

  return (
    <div className="flex h-dvh w-full max-w-none min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-11 w-full shrink-0 items-center gap-2 border-b border-border bg-surface px-2 lg:hidden">
        <Button size="icon-sm" variant="ghost" onClick={() => setLeftOpen(true)} aria-label="Otvoriť panel prípadu">
          <Menu className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-2xs tracking-widest text-accent uppercase">{active?.reference}</p>
          <p className="truncate text-xs">{active?.name}</p>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={() => setRightOpen(true)} aria-label="Otvoriť panel AI">
          <ScanSearch className="size-4" />
        </Button>
      </header>

      <div className="flex min-h-0 w-full flex-1">
        <aside className="hidden h-full w-64 shrink-0 border-r border-border lg:block">
          <LeftSidebar />
        </aside>
        <EvidenceViewer />
        <aside className="hidden h-full w-80 shrink-0 border-l border-border xl:block">
          <AiPanel />
        </aside>
      </div>
      <StatusBar />
      <CommandPalette />
      <WorkspaceDialogs />

      <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
        <SheetContent side="left" className="h-dvh w-full max-w-none rounded-none p-0">
          <LeftSidebar />
        </SheetContent>
      </Sheet>
      <Sheet open={rightOpen} onOpenChange={setRightOpen}>
        <SheetContent side="right" className="h-dvh w-full max-w-none rounded-none p-0">
          <AiPanel />
        </SheetContent>
      </Sheet>
    </div>
  );
}
