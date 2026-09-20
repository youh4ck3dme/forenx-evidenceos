import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/features/theme/ThemeProvider";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "ForenX EvidenceOS";

const THEME_BOOTSTRAP = `(function(){try{var r=localStorage.getItem("forenx.theme");if(!r)return;var t=JSON.parse(r);if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t;}}catch(e){}})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content: "Lokálne forenzné pracovisko. Nemenné originály, SHA-256 a štruktúrovaná AI analýza.",
      },
      { name: "theme-color", content: "#0a0b0c" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="sk" className="antialiased" data-theme="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <PreviewHostBridge />
        <AuthProvider>
          <ThemeProvider>
            <TooltipProvider delayDuration={200}>
              <Outlet />
              <ThemedToaster />
            </TooltipProvider>
          </ThemeProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      toastOptions={{
        className: "font-sans",
        style: {
          background: "var(--fx-surface)",
          border: "1px solid var(--fx-border)",
          color: "var(--fx-fg)",
        },
      }}
    />
  );
}
