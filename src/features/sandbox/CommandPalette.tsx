import { useEffect } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FORENSIC_ACTIONS } from "@/lib/ai/actions";
import { useWorkspace } from "@/features/workspace/store";

export function CommandPalette() {
  const open = useWorkspace((s) => s.commandOpen);
  const setOpen = useWorkspace((s) => s.setCommandOpen);
  const requestAction = useWorkspace((s) => s.requestAction);
  const setAuditOpen = useWorkspace((s) => s.setAuditOpen);
  const setCreateCaseOpen = useWorkspace((s) => s.setCreateCaseOpen);
  const exportCase = useWorkspace((s) => s.exportCase);
  const setSearchQuery = useWorkspace((s) => s.setSearchQuery);
  const setLeftView = useWorkspace((s) => s.setLeftView);
  const setWorkspaceMode = useWorkspace((s) => s.setWorkspaceMode);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Hľadať príkazy, dôkazy, úkony…" />
      <CommandList>
        <CommandEmpty>Žiadny zodpovedajúci príkaz.</CommandEmpty>
        <CommandGroup heading="Pracovisko">
          <CommandItem
            onSelect={() => {
              document.querySelector<HTMLInputElement>('input[type="file"]')?.click();
              setOpen(false);
            }}
          >
            Pridať dôkaz
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setCreateCaseOpen(true);
              setOpen(false);
            }}
          >
            Vytvoriť prípad
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setWorkspaceMode("malte");
              setOpen(false);
            }}
          >
            Otvoriť Malte
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setWorkspaceMode("evidence");
              setLeftView("evidence");
              setSearchQuery("");
              setOpen(false);
              const el = document.querySelector<HTMLInputElement>('[data-search="evidence"]');
              el?.focus();
            }}
          >
            Hľadať v dôkazoch
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setAuditOpen(true);
              setOpen(false);
            }}
          >
            Otvoriť záznam udalostí
          </CommandItem>
          <CommandItem
            onSelect={() => {
              void exportCase("json");
              setOpen(false);
            }}
          >
            Exportovať JSON
          </CommandItem>
          <CommandItem
            onSelect={() => {
              void exportCase("markdown");
              setOpen(false);
            }}
          >
            Exportovať Markdown
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Forenzné úkony">
          {FORENSIC_ACTIONS.map((action) => (
            <CommandItem
              key={action.id}
              onSelect={() => {
                requestAction(action.id);
                setOpen(false);
              }}
            >
              {action.number} {action.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
