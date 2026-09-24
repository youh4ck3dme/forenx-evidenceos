import { create } from "zustand";
import type {
  AiAvailability,
  AiRunRecord,
  AuditEventRecord,
  CaseRecord,
  Classification,
  EntityRecord,
  EvidenceRecord,
  EvidenceSection,
  ExtractionRecord,
  FindingRecord,
  ReviewStatus,
  TimelineEventRecord,
} from "@/domain/types";
import { PROMPT_VERSION, WORKSPACE_ID } from "@/domain/types";
import { FORENSIC_ACTIONS, getAction, type ForensicAction } from "@/lib/ai/actions";
import { analyzeEvidence, getAiStatus } from "@/lib/ai/analyze";
import { normalizeAnalysis } from "@/lib/ai/normalize";
import { scoreAnomaly, scoreQuestion, stableScoreCaseRisk } from "@/lib/scoring/score";
import { buildCaseExport, downloadText, exportToMarkdown } from "@/features/export/export-case";
import { ingestFile } from "@/features/ingestion/ingest";
import { skCount } from "@/lib/copy";
import { createId, nextCaseReference } from "@/lib/ids";
import { getDb } from "@/lib/storage/db";
import { estimateStorage } from "@/lib/storage/files";
import { loadSettings, saveSettings } from "@/lib/storage/settings";
import { toast } from "sonner";

export type LeftView = "evidence" | "timeline" | "entities" | "findings" | "reports";
export type WorkspaceMode = "evidence" | "malte";

interface WorkspaceState {
  hydrated: boolean;
  cases: CaseRecord[];
  activeCaseId: string | null;
  evidence: EvidenceRecord[];
  extractions: ExtractionRecord[];
  findings: FindingRecord[];
  entities: EntityRecord[];
  timeline: TimelineEventRecord[];
  aiRuns: AiRunRecord[];
  audit: AuditEventRecord[];
  selectedId: string | null;
  selectedIds: string[];
  leftView: LeftView;
  workspaceMode: WorkspaceMode;
  searchQuery: string;
  commandOpen: boolean;
  auditOpen: boolean;
  createCaseOpen: boolean;
  pendingAction: ForensicAction | null;
  ingestBusy: boolean;
  ingestMessage: string | null;
  aiAvailability: AiAvailability;
  storageUsed: number;
  storageQuota: number;
  error: string | null;

  hydrate: () => Promise<void>;
  enterSandbox: () => Promise<void>;
  refreshStorage: () => Promise<void>;
  pingAi: () => Promise<void>;
  setActiveCase: (id: string) => Promise<void>;
  createCase: (input: {
    name: string;
    description: string;
    classification: Classification;
    tags: string[];
  }) => Promise<CaseRecord>;
  importFiles: (files: File[]) => Promise<void>;
  selectEvidence: (id: string | null, additive?: boolean) => void;
  setLeftView: (view: LeftView) => void;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  refreshAudit: () => Promise<void>;
  setSearchQuery: (q: string) => void;
  setCommandOpen: (open: boolean) => void;
  setAuditOpen: (open: boolean) => void;
  setCreateCaseOpen: (open: boolean) => void;
  requestAction: (actionId: string) => void;
  cancelAction: () => void;
  confirmAction: () => Promise<void>;
  setSection: (evidenceId: string, section: EvidenceSection) => Promise<void>;
  reviewFinding: (id: string, status: ReviewStatus) => Promise<void>;
  exportCase: (format: "json" | "markdown") => Promise<void>;
}

async function loadCaseSlice(caseId: string) {
  const db = getDb();
  const [evidence, extractions, findings, entities, timeline, aiRuns, audit] = await Promise.all([
    db.evidence.where("caseId").equals(caseId).reverse().sortBy("importedAt"),
    db.extractions.where("caseId").equals(caseId).toArray(),
    db.findings.where("caseId").equals(caseId).reverse().sortBy("createdAt"),
    db.entities.where("caseId").equals(caseId).toArray(),
    db.timelineEvents.where("caseId").equals(caseId).toArray(),
    db.aiRuns.where("caseId").equals(caseId).reverse().sortBy("createdAt"),
    db.auditEvents.where("caseId").equals(caseId).reverse().sortBy("createdAt"),
  ]);
  evidence.reverse();
  findings.reverse();
  aiRuns.reverse();
  audit.reverse();
  return { evidence, extractions, findings, entities, timeline, aiRuns, audit };
}

async function appendAudit(event: Omit<AuditEventRecord, "id" | "createdAt">) {
  const record: AuditEventRecord = {
    ...event,
    id: createId("aud"),
    createdAt: new Date().toISOString(),
  };
  await getDb().auditEvents.add(record);
  return record;
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  hydrated: false,
  cases: [],
  activeCaseId: null,
  evidence: [],
  extractions: [],
  findings: [],
  entities: [],
  timeline: [],
  aiRuns: [],
  audit: [],
  selectedId: null,
  selectedIds: [],
  leftView: "evidence",
  workspaceMode: "evidence",
  searchQuery: "",
  commandOpen: false,
  auditOpen: false,
  createCaseOpen: false,
  pendingAction: null,
  ingestBusy: false,
  ingestMessage: null,
  aiAvailability: "UNAVAILABLE",
  storageUsed: 0,
  storageQuota: 0,
  error: null,

  hydrate: async () => {
    if (typeof indexedDB === "undefined") return;
    if (get().hydrated) {
      void get().refreshStorage();
      void get().pingAi();
      return;
    }
    const db = getDb();
    const settings = loadSettings();
    const cases = await db.cases.orderBy("updatedAt").reverse().toArray();
    for (const record of cases) {
      if (record.name === "Untitled investigation" || record.name === "Local sandbox") {
        const name = "Lokálne vyšetrovanie";
        const description =
          record.description === "Local sandbox case. Evidence remains on this device." ||
          !record.description
            ? "Lokálny prípad. Dôkazy ostávajú v tomto zariadení."
            : record.description;
        await db.cases.update(record.id, { name, description });
        record.name = name;
        record.description = description;
      }
    }
    let activeCaseId = settings.activeCaseId;
    if (activeCaseId && !cases.some((c) => c.id === activeCaseId))
      activeCaseId = cases[0]?.id ?? null;
    if (!activeCaseId) activeCaseId = cases[0]?.id ?? null;
    const slice = activeCaseId
      ? await loadCaseSlice(activeCaseId)
      : {
          evidence: [],
          extractions: [],
          findings: [],
          entities: [],
          timeline: [],
          aiRuns: [],
          audit: [],
        };
    set({
      hydrated: true,
      cases,
      activeCaseId,
      ...slice,
      selectedId: slice.evidence[0]?.id ?? null,
      selectedIds: slice.evidence[0] ? [slice.evidence[0].id] : [],
    });
    void get().refreshStorage();
    void get().pingAi();
  },

  enterSandbox: async () => {
    saveSettings({ hasEnteredSandbox: true });
    if (!get().hydrated) await get().hydrate();
    if (get().cases.length === 0) {
      await get().createCase({
        name: "Lokálne vyšetrovanie",
        description: "Lokálny prípad. Dôkazy ostávajú v tomto zariadení.",
        classification: "CONFIDENTIAL",
        tags: [],
      });
    }
  },

  refreshStorage: async () => {
    const { used, quota } = await estimateStorage();
    set({ storageUsed: used, storageQuota: quota });
  },

  pingAi: async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      set({ aiAvailability: "OFFLINE" });
      return;
    }
    try {
      const status = await getAiStatus();
      set({ aiAvailability: status.available ? "LIVE" : "UNAVAILABLE" });
    } catch {
      set({ aiAvailability: "OFFLINE" });
    }
  },

  setActiveCase: async (id) => {
    const slice = await loadCaseSlice(id);
    saveSettings({ activeCaseId: id, hasEnteredSandbox: true });
    set({
      activeCaseId: id,
      ...slice,
      selectedId: slice.evidence[0]?.id ?? null,
      selectedIds: slice.evidence[0] ? [slice.evidence[0].id] : [],
      leftView: "evidence",
    });
  },

  createCase: async (input) => {
    const now = new Date().toISOString();
    const record: CaseRecord = {
      id: createId("case"),
      workspaceId: WORKSPACE_ID,
      name: input.name.trim() || "Nové vyšetrovanie",
      reference: nextCaseReference(get().cases.map((c) => c.reference)),
      description: input.description.trim(),
      createdAt: now,
      updatedAt: now,
      status: "ACTIVE",
      classification: input.classification,
      tags: input.tags,
    };
    await getDb().cases.add(record);
    const audit = await appendAudit({
      caseId: record.id,
      type: "CASE_CREATED",
      message: `Vytvorený prípad ${record.reference}`,
      payload: { name: record.name, classification: record.classification },
    });
    saveSettings({ activeCaseId: record.id, hasEnteredSandbox: true });
    set((s) => ({
      cases: [record, ...s.cases],
      activeCaseId: record.id,
      evidence: [],
      extractions: [],
      findings: [],
      entities: [],
      timeline: [],
      aiRuns: [],
      audit: [audit],
      selectedId: null,
      selectedIds: [],
      createCaseOpen: false,
    }));
    return record;
  },

  importFiles: async (files) => {
    const caseId = get().activeCaseId;
    if (!caseId || files.length === 0) return;
    set({
      ingestBusy: true,
      ingestMessage: `Vkladám ${skCount(files.length, "súbor", "súbory", "súborov")}…`,
    });
    const db = getDb();
    const hashes = new Map(get().evidence.map((e) => [e.sha256, e.id]));
    const imported: EvidenceRecord[] = [];
    const extractions: ExtractionRecord[] = [];
    const audits: AuditEventRecord[] = [];
    try {
      for (const file of files) {
        set({ ingestMessage: `Počítam SHA-256: ${file.name}` });
        const result = await ingestFile(file, caseId, hashes);
        hashes.set(result.evidence.sha256, result.evidence.id);
        await db.evidence.add(result.evidence);
        imported.push(result.evidence);
        audits.push(
          await appendAudit({
            caseId,
            type: "EVIDENCE_IMPORTED",
            message: `Vložený súbor ${file.name}`,
            payload: { evidenceId: result.evidence.id, name: file.name, size: file.size },
          }),
        );
        audits.push(
          await appendAudit({
            caseId,
            type: "EVIDENCE_HASHED",
            message: `SHA-256 ${result.evidence.sha256.slice(0, 12)}… ${file.name}`,
            payload: { evidenceId: result.evidence.id, sha256: result.evidence.sha256 },
          }),
        );
        if (result.extraction) {
          await db.extractions.add(result.extraction);
          extractions.push(result.extraction);
          audits.push(
            await appendAudit({
              caseId,
              type: "EXTRACTION_CREATED",
              message: `Extrahovaných ${result.extraction.wordCount} slov zo súboru ${file.name}`,
              payload: { evidenceId: result.evidence.id, processor: result.extraction.processor },
            }),
          );
        }
      }
      await db.cases.update(caseId, { updatedAt: new Date().toISOString() });
      set((s) => ({
        evidence: [...imported, ...s.evidence],
        extractions: [...extractions, ...s.extractions],
        audit: [...audits, ...s.audit],
        selectedId: imported[0]?.id ?? s.selectedId,
        selectedIds: imported[0] ? [imported[0].id] : s.selectedIds,
        ingestBusy: false,
        ingestMessage: null,
      }));
      toast.success(`Vložené: ${skCount(imported.length, "dôkaz", "dôkazy", "dôkazov")}`);
      void get().refreshStorage();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Vloženie zlyhalo";
      set({ ingestBusy: false, ingestMessage: null, error: message });
      toast.error(message);
    }
  },

  selectEvidence: (id, additive = false) => {
    if (!id) {
      set({ selectedId: null, selectedIds: [] });
      return;
    }
    const caseId = get().activeCaseId;
    if (additive) {
      const next = get().selectedIds.includes(id)
        ? get().selectedIds.filter((x) => x !== id)
        : [...get().selectedIds, id];
      set({ selectedId: id, selectedIds: next.length ? next : [id] });
    } else {
      set({ selectedId: id, selectedIds: [id] });
    }
    if (caseId) {
      void appendAudit({
        caseId,
        type: "EVIDENCE_SELECTED",
        message: `Vybraný dôkaz ${id}`,
        payload: { evidenceId: id },
      }).then((event) => set((s) => ({ audit: [event, ...s.audit] })));
    }
  },

  setLeftView: (leftView) => set({ leftView }),
  setWorkspaceMode: (workspaceMode) => set({ workspaceMode }),
  refreshAudit: async () => {
    if (typeof indexedDB === "undefined") return;
    const caseId = get().activeCaseId;
    if (!caseId) return;
    const audit = await getDb()
      .auditEvents.where("caseId")
      .equals(caseId)
      .reverse()
      .sortBy("createdAt");
    audit.reverse();
    set({ audit });
  },
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setAuditOpen: (auditOpen) => set({ auditOpen }),
  setCreateCaseOpen: (createCaseOpen) => set({ createCaseOpen }),

  requestAction: (actionId) => {
    const action = getAction(actionId) ?? FORENSIC_ACTIONS.find((a) => a.id === actionId);
    if (!action) return;
    if (get().aiAvailability === "OFFLINE") {
      toast.error("AI je bez pripojenia. Analýza sa nespustila.");
      return;
    }
    if (get().aiAvailability === "UNAVAILABLE") {
      toast.error("Služba AI je nedostupná. Analýza sa nespustila.");
      return;
    }
    const needsEvidence = action.requiredInputs.includes("evidence");
    if (
      needsEvidence &&
      get().selectedIds.length === 0 &&
      action.id !== "case-report" &&
      action.id !== "evidence-gaps" &&
      action.id !== "investigator-questions"
    ) {
      toast.error("Pred spustením tohto úkonu vyberte dôkaz.");
      return;
    }
    set({ pendingAction: action });
  },

  cancelAction: () => set({ pendingAction: null }),

  confirmAction: async () => {
    const action = get().pendingAction;
    const caseId = get().activeCaseId;
    const caseRecord = get().cases.find((c) => c.id === caseId);
    if (!action || !caseId || !caseRecord) {
      set({ pendingAction: null });
      return;
    }
    set({ pendingAction: null, aiAvailability: "RUNNING" });

    const selected = get().selectedIds;
    let evidenceIds =
      action.id === "case-report" ||
      action.id === "evidence-gaps" ||
      action.id === "investigator-questions"
        ? get().evidence.map((e) => e.id)
        : selected;
    if (evidenceIds.length === 0) evidenceIds = get().evidence.map((e) => e.id);

    const run: AiRunRecord = {
      id: createId("run"),
      caseId,
      actionId: action.id,
      evidenceIds,
      promptVersion: action.promptVersion,
      model: null,
      status: "STARTED",
      createdAt: new Date().toISOString(),
    };
    await getDb().aiRuns.add(run);
    const started = await appendAudit({
      caseId,
      type: "AI_ANALYSIS_STARTED",
      message: `Spustené: ${action.name}`,
      payload: { runId: run.id, actionId: action.id },
    });
    set((s) => ({ aiRuns: [run, ...s.aiRuns], audit: [started, ...s.audit] }));

    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw Object.assign(new Error("Bez pripojenia — analýza sa neodoslala."), {
          code: "OFFLINE",
        });
      }
      const extractionByEv = new Map(get().extractions.map((e) => [e.evidenceId, e]));
      const payload = evidenceIds
        .map((id) => get().evidence.find((e) => e.id === id))
        .filter((e): e is EvidenceRecord => Boolean(e))
        .slice(0, 6)
        .map((item) => ({
          id: item.id,
          originalName: item.originalName,
          sha256: item.sha256,
          detectedKind: item.detectedKind,
          detectedMime: item.detectedMime,
          byteSize: item.byteSize,
          section: item.section,
          metadata: extractionByEv.get(item.id)?.metadata ?? {},
          text: extractionByEv.get(item.id)?.text ?? "",
        }));

      const findingsDigest = action.requiredInputs.includes("findings")
        ? get()
            .findings.slice(0, 40)
            .map((f) => `[${f.epistemicClass} ${f.confidence.toFixed(2)}] ${f.statement}`)
            .join("\n")
        : undefined;

      const result = await analyzeEvidence({
        data: {
          actionId: action.id,
          caseId,
          caseName: caseRecord.name,
          caseReference: caseRecord.reference,
          workspaceLanguage: "Slovak",
          evidence: payload,
          findingsDigest,
        },
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      const normalized = normalizeAnalysis(JSON.parse(result.resultJson) as unknown);
      const createdAt = new Date().toISOString();
      const findings: FindingRecord[] = normalized.findings.map((f) => ({
        ...f,
        id: createId("find"),
        caseId,
        actionId: action.id,
        promptVersion: PROMPT_VERSION,
        model: result.model,
        createdAt,
        reviewStatus: "PENDING",
        runId: run.id,
      }));
      const entities: EntityRecord[] = normalized.entities.map((e) => ({
        ...e,
        id: createId("ent"),
        caseId,
        createdAt,
        runId: run.id,
      }));
      const timeline: TimelineEventRecord[] = normalized.events.map((e) => ({
        ...e,
        id: createId("tl"),
        eventId: createId("evt"),
        caseId,
        createdAt,
        runId: run.id,
      }));

      const extraFindings: FindingRecord[] = [
        ...normalized.questions.map((q) => {
          const scored = scoreQuestion(q, evidenceIds);
          return {
            id: createId("find"),
            caseId,
            evidenceIds,
            actionId: action.id,
            promptVersion: PROMPT_VERSION,
            model: result.model,
            createdAt,
            statement: `Otázka: ${q}`,
            epistemicClass: "HYPOTHESIS" as const,
            confidence: scored.confidence,
            sourceReferences: [],
            reviewStatus: "PENDING" as const,
            runId: run.id,
            scoreEngineVersion: scored.engineVersion,
            scoreReasons: scored.reasons,
          };
        }),
        ...normalized.anomalies.map((a) => {
          const scored = scoreAnomaly(a, evidenceIds);
          return {
            id: createId("find"),
            caseId,
            evidenceIds,
            actionId: action.id,
            promptVersion: PROMPT_VERSION,
            model: result.model,
            createdAt,
            statement: `Nezrovnalosť: ${a}`,
            epistemicClass: "INFERRED" as const,
            confidence: scored.confidence,
            sourceReferences: [],
            reviewStatus: "NEEDS_REVIEW" as const,
            runId: run.id,
            scoreEngineVersion: scored.engineVersion,
            scoreReasons: scored.reasons,
          };
        }),
      ];
      const allFindings = [...findings, ...extraFindings];

      if (normalized.primarySection && evidenceIds.length === 1) {
        const evidenceId = evidenceIds[0]!;
        const item = get().evidence.find((e) => e.id === evidenceId);
        if (item && item.sectionSource !== "HUMAN") {
          await getDb().evidence.update(evidenceId, {
            section: normalized.primarySection,
            sectionSource: "AI",
            status: "ANALYZED",
          });
          set((s) => ({
            evidence: s.evidence.map((e) =>
              e.id === evidenceId
                ? {
                    ...e,
                    section: normalized.primarySection!,
                    sectionSource: "AI",
                    status: "ANALYZED",
                  }
                : e,
            ),
          }));
        } else if (item) {
          await getDb().evidence.update(evidenceId, { status: "ANALYZED" });
          set((s) => ({
            evidence: s.evidence.map((e) =>
              e.id === evidenceId ? { ...e, status: "ANALYZED" } : e,
            ),
          }));
        }
      } else {
        for (const id of evidenceIds) {
          await getDb().evidence.update(id, { status: "ANALYZED" });
        }
        set((s) => ({
          evidence: s.evidence.map((e) =>
            evidenceIds.includes(e.id) ? { ...e, status: "ANALYZED" } : e,
          ),
        }));
      }

      const completed: AiRunRecord = {
        ...run,
        status: "COMPLETED",
        model: result.model,
        completedAt: createdAt,
        summary: normalized.summary || normalized.title,
        rawJson: result.resultJson,
      };
      const db = getDb();
      if (allFindings.length) await db.findings.bulkAdd(allFindings);
      if (entities.length) await db.entities.bulkAdd(entities);
      if (timeline.length) await db.timelineEvents.bulkAdd(timeline);
      await db.aiRuns.put(completed);
      const done = await appendAudit({
        caseId,
        type: "AI_ANALYSIS_COMPLETED",
        message: `Dokončené: ${action.name} (${allFindings.length} zistení)`,
        payload: { runId: run.id, actionId: action.id, model: result.model },
      });
      set((s) => ({
        findings: [...allFindings, ...s.findings],
        entities: [...entities, ...s.entities],
        timeline: [...timeline, ...s.timeline],
        aiRuns: s.aiRuns.map((r) => (r.id === run.id ? completed : r)),
        audit: [done, ...s.audit],
        aiAvailability: "LIVE",
        leftView:
          action.id === "timeline"
            ? "timeline"
            : action.id === "entity-extraction"
              ? "entities"
              : action.id === "case-report"
                ? "reports"
                : "findings",
      }));
      toast.success(`${action.name} — dokončené`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analýza zlyhala";
      const failed: AiRunRecord = {
        ...run,
        status: "FAILED",
        completedAt: new Date().toISOString(),
        error: message,
      };
      await getDb().aiRuns.put(failed);
      const failAudit = await appendAudit({
        caseId,
        type: "AI_ANALYSIS_FAILED",
        message: `${action.name} zlyhalo: ${message}`,
        payload: { runId: run.id, actionId: action.id },
      });
      const offline = /offline|pripojenia/i.test(message);
      set((s) => ({
        aiRuns: s.aiRuns.map((r) => (r.id === run.id ? failed : r)),
        audit: [failAudit, ...s.audit],
        aiAvailability: offline ? "OFFLINE" : "LIVE",
      }));
      toast.error(message);
    }
  },

  setSection: async (evidenceId, section) => {
    await getDb().evidence.update(evidenceId, { section, sectionSource: "HUMAN" });
    set((s) => ({
      evidence: s.evidence.map((e) =>
        e.id === evidenceId ? { ...e, section, sectionSource: "HUMAN" } : e,
      ),
    }));
  },

  reviewFinding: async (id, status) => {
    await getDb().findings.update(id, { reviewStatus: status });
    const caseId = get().activeCaseId;
    const audit = caseId
      ? await appendAudit({
          caseId,
          type: "FINDING_REVIEWED",
          message: `Zistenie ${id} označené ako ${status === "ACCEPTED" ? "prijaté" : status === "REJECTED" ? "odmietnuté" : status}`,
          payload: { findingId: id, status },
        })
      : null;
    set((s) => ({
      findings: s.findings.map((f) => (f.id === id ? { ...f, reviewStatus: status } : f)),
      audit: audit ? [audit, ...s.audit] : s.audit,
    }));
  },

  exportCase: async (format) => {
    const caseId = get().activeCaseId;
    const caseRecord = get().cases.find((c) => c.id === caseId);
    if (!caseRecord) return;
    const bundle = buildCaseExport({
      caseRecord,
      evidence: get().evidence,
      extractions: get().extractions,
      findings: get().findings,
      entities: get().entities,
      timeline: get().timeline,
      aiRuns: get().aiRuns,
      audit: get().audit,
    });
    const stamp = caseRecord.reference.toLowerCase();
    if (format === "json") {
      downloadText(`${stamp}.json`, JSON.stringify(bundle, null, 2), "application/json");
    } else {
      downloadText(`${stamp}.md`, exportToMarkdown(bundle), "text/markdown");
    }
    const audit = await appendAudit({
      caseId,
      type: "EXPORT_CREATED",
      message: `Prípad exportovaný ako ${format.toUpperCase()}`,
      payload: { format },
    });
    set((s) => ({ audit: [audit, ...s.audit] }));
    toast.success(`Exportované: ${format.toUpperCase()}`);
  },
}));

export function selectActiveCase(state: WorkspaceState): CaseRecord | null {
  return state.cases.find((c) => c.id === state.activeCaseId) ?? null;
}

export function selectSelectedEvidence(state: WorkspaceState): EvidenceRecord | null {
  return state.evidence.find((e) => e.id === state.selectedId) ?? null;
}

export function selectCaseRisk(state: WorkspaceState) {
  return stableScoreCaseRisk(state.findings);
}
