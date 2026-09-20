import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/features/theme/ThemeProvider";
import { cn } from "@/lib/utils";

export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Farba prostredia"
      className={cn("inline-flex h-8 rounded-md border border-border bg-background p-0.5", className)}
    >
      <button
        type="button"
        aria-label="Svetlá téma"
        aria-pressed={theme === "light"}
        onClick={() => setTheme("light")}
        className={cn(
          "grid size-7 place-items-center rounded-sm text-subtle transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:text-foreground",
          theme === "light" && "bg-elevated text-foreground",
        )}
      >
        <Sun className="size-3.5" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        aria-label="Tmavá téma"
        aria-pressed={theme === "dark"}
        onClick={() => setTheme("dark")}
        className={cn(
          "grid size-7 place-items-center rounded-sm text-subtle transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:text-foreground",
          theme === "dark" && "bg-elevated text-foreground",
        )}
      >
        <Moon className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
