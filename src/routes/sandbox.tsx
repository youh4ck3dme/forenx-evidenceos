import { createFileRoute } from "@tanstack/react-router";
import { SandboxShell } from "@/features/sandbox/SandboxShell";

export const Route = createFileRoute("/sandbox")({ component: SandboxShell });
