import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeSwitch } from "@/features/theme/ThemeSwitch";
import { useWorkspace } from "@/features/workspace/store";

export function WelcomePage() {
  const navigate = useNavigate();
  const enterSandbox = useWorkspace((s) => s.enterSandbox);

  async function enter() {
    await enterSandbox();
    await navigate({ to: "/sandbox" });
  }

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div className="lab-grid pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute inset-x-8 top-8 bottom-8 border border-border/80 max-md:inset-3" />
      <div className="relative flex flex-1 flex-col justify-between px-10 py-8 max-md:px-5">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center border border-border font-mono text-xs tracking-widest">
              FX
            </span>
            <p className="font-mono text-2xs tracking-widest text-muted-foreground uppercase">
              ForenX EvidenceOS
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden font-mono text-2xs tracking-widest text-subtle uppercase sm:block">
              Lokálne prostredie
            </p>
            <ThemeSwitch />
          </div>
        </header>

        <section className="mx-auto flex w-full max-w-3xl flex-col items-start gap-8 py-16 max-md:py-10">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">Forenzné pracovisko</p>
          <h1 className="font-display text-4xl leading-none font-medium tracking-tight text-foreground max-md:text-3xl">
            FORENX
            <span className="mt-2 block text-muted-foreground">SYSTÉM DÔKAZOV</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
            Lokálne forenzné pracovisko s AI. Originály tento prehliadač neopustia. Súbory zahashujete,
            extrahujete, triedite a spracujete bez prihlásenia a bez vzdialenej databázy.
          </p>
          <Button size="lg" className="h-12 rounded-md px-7 tracking-widest uppercase" onClick={() => void enter()}>
            Vstúpiť do prostredia
            <ArrowRight className="size-4" />
          </Button>
        </section>

        <footer className="grid grid-cols-4 gap-6 border-t border-border pt-6 max-md:grid-cols-2">
          {[
            ["100 % lokálne", "OPFS a IndexedDB. Bez vzdialenej databázy."],
            ["Nemenné originály", "Pri vložení sa spočíta SHA-256. Originály sa nemenia."],
            ["Štruktúrovaná AI", "Dvadsať forenzných úkonov. Každý záver musí mať zdroj."],
            ["Aj bez siete", "Pracovisko ostáva dostupné. AI nepredstiera, že je online."],
          ].map(([title, copy]) => (
            <div key={title}>
              <p className="font-mono text-2xs tracking-widest text-accent uppercase">{title}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{copy}</p>
            </div>
          ))}
        </footer>
      </div>
    </main>
  );
}
