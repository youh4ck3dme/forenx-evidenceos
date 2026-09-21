import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/features/theme/ThemeProvider";
import { registerForenxSw } from "@/lib/pwa/register-sw";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "ForenX EvidenceOS";

const THEME_BOOTSTRAP = `(function(){try{var r=localStorage.getItem("forenx.theme");if(!r)return;var t=JSON.parse(r);if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t;}}catch(e){}})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover",
      },
      { title: APP_NAME },
      {
        name: "description",
        content: "Lokálne forenzné pracovisko. Nemenné originály, SHA-256 a štruktúrovaná AI analýza.",
      },
      { name: "theme-color", content: "#0a0b0c" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/icons/icon.svg" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  useEffect(() => {
    registerForenxSw();
  }, []);

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
