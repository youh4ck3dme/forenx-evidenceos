import { createServerFn } from "@tanstack/react-start";
import { buildSystemPrompt, getAction } from "@/lib/ai/actions";
import {
  buildSealedUserContent,
  formatEvidenceBlock,
  sealEvidenceItems,
} from "@/lib/security/prompt-boundary";

export interface AnalyzeEvidenceInput {
  actionId: string;
  caseId: string;
  caseName: string;
  caseReference: string;
  workspaceLanguage: string;
  evidence: Array<{
    id: string;
    originalName: string;
    sha256: string;
    detectedKind: string;
    detectedMime: string;
    byteSize: number;
    section: string;
    metadata: Record<string, string | number | boolean | null>;
    text: string;
  }>;
  findingsDigest?: string;
}

export interface AnalyzeEvidenceSuccess {
  ok: true;
  model: string;
  resultJson: string;
  boundary: {
    redactions: number;
    kinds: string[];
  };
}

export interface AnalyzeEvidenceFailure {
  ok: false;
  error: string;
  code: "NO_KEY" | "UNKNOWN_ACTION" | "API_ERROR" | "PARSE_ERROR";
}

export type AnalyzeEvidenceResult = AnalyzeEvidenceSuccess | AnalyzeEvidenceFailure;

const MODEL = "mistral-large-latest";

export const getAiStatus = createServerFn({ method: "POST" }).handler(async () => {
  return { available: Boolean(process.env.MISTRAL_API_KEY) };
});

export const analyzeEvidence = createServerFn({ method: "POST" })
  .validator((input: AnalyzeEvidenceInput) => input)
  .handler(async ({ data }): Promise<AnalyzeEvidenceResult> => {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "Služba AI v tomto prostredí nie je dostupná.", code: "NO_KEY" };
    }

    const action = getAction(data.actionId);
    if (!action) {
      return { ok: false, error: "Neznámy forenzný úkon.", code: "UNKNOWN_ACTION" };
    }

    const sealed = sealEvidenceItems(data.evidence);

    const context = {
      workspaceId: "local-workspace",
      caseId: data.caseId,
      caseName: data.caseName,
      caseReference: data.caseReference,
      workspaceLanguage: data.workspaceLanguage,
      actionId: action.id,
      promptVersion: action.promptVersion,
      evidenceCount: sealed.items.length,
    };

    const boundaryNote =
      sealed.totalRedactions > 0
        ? `BOUNDARY: ${sealed.totalRedactions} redaction(s) applied (${sealed.kinds.join(", ")}). Original bytes stay in local custody.`
        : "BOUNDARY: no identifier redactions; markers and injection phrases still neutralized.";

    const userContent = buildSealedUserContent({
      context,
      findingsDigest: data.findingsDigest,
      evidenceBlock: formatEvidenceBlock(sealed.items),
      boundaryNote,
    });

    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: data.actionId === "case-report" ? 4000 : 2500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt(action) },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Služba AI vrátila stav ${res.status}. ${body.slice(0, 240)}`.trim(),
        code: "API_ERROR",
      };
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content ?? "";
    try {
      JSON.parse(stripFences(content));
      return {
        ok: true,
        model: MODEL,
        resultJson: stripFences(content),
        boundary: { redactions: sealed.totalRedactions, kinds: sealed.kinds },
      };
    } catch {
      return { ok: false, error: "Model vrátil nespracovateľný výstup.", code: "PARSE_ERROR" };
    }
  });

function stripFences(text: string): string {
  const trimmed = text.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return match?.[1]?.trim() ?? trimmed;
}
