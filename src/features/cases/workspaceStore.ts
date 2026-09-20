import { create } from 'zustand'
import { loadSettings, patchSettings } from '@/lib/storage/settings'
import {
  localAiRunRepository,
  localAuditRepository,
  localCaseRepository,
  localEntityRepository,
  localEvidenceRepository,
  localFindingRepository,
  localTimelineRepository,
} from '@/lib/storage/repositories'
import type {
  AiRunRecord,
  AuditEvent,
  CaseRecord,
  EntityRecord,
  EvidenceItem,
  FindingRecord,
  TimelineEventRecord,
} from '@/lib/storage/types'
import { createId } from '@/lib/utils/cn'
import { estimateStorage } from '@/lib/storage/opfs'
import type { AiConnectionStatus } from '@/features/ai/provider'
import { probeAiStatus } from '@/features/ai/resolveProvider'
import { ingestFiles } from '@/features/ingestion/ingest'
import { t } from '@/lib/i18n'

interface WorkspaceState {
  ready: boolean
  workspaceId: string
  enteredSandbox: boolean
  cases: CaseRecord[]
  activeCaseId: string | null
  evidence: EvidenceItem[]
  selectedEvidenceIds: string[]
  findings: FindingRecord[]
  entities: EntityRecord[]
  timelineEvents: TimelineEventRecord[]
  auditEvents: AuditEvent[]
  aiRuns: AiRunRecord[]
  aiStatus: AiConnectionStatus
  aiBusy: boolean
  aiError: string | null
  storageUsage: number
  storageQuota: number
  leftTab: 'evidence' | 'timeline' | 'entities' | 'findings' | 'reports'
  commandOpen: boolean
  auditOpen: boolean
  mobilePanel: 'none' | 'cases' | 'ai'
  ingestBusy: boolean
  statusMessage: string | null

  init: () => Promise<void>
  enterSandbox: () => void
  createCase: (input?: { name?: string; description?: string }) => Promise<CaseRecord>
  selectCase: (caseId: string) => Promise<void>
  refreshCaseData: () => Promise<void>
  setSelectedEvidence: (ids: string[]) => void
  toggleEvidenceSelection: (id: string) => void
  importEvidence: (files: FileList | File[]) => Promise<void>
  setLeftTab: (tab: WorkspaceState['leftTab']) => void
  setCommandOpen: (open: boolean) => void
  setAuditOpen: (open: boolean) => void
  setMobilePanel: (panel: WorkspaceState['mobilePanel']) => void
  refreshAiStatus: () => Promise<void>
  setAiBusy: (busy: boolean, error?: string | null) => void
  setStatusMessage: (message: string | null) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  ready: false,
  workspaceId: '',
  enteredSandbox: false,
  cases: [],
  activeCaseId: null,
  evidence: [],
  selectedEvidenceIds: [],
  findings: [],
  entities: [],
  timelineEvents: [],
  auditEvents: [],
  aiRuns: [],
  aiStatus: 'IDLE',
  aiBusy: false,
  aiError: null,
  storageUsage: 0,
  storageQuota: 0,
  leftTab: 'evidence',
  commandOpen: false,
  auditOpen: false,
  mobilePanel: 'none',
  ingestBusy: false,
  statusMessage: null,

  init: async () => {
    const settings = loadSettings()
    const cases = await localCaseRepository.list()
    const storage = await estimateStorage()
    set({
      ready: true,
      workspaceId: settings.workspaceId,
      enteredSandbox: settings.enteredSandbox,
      cases,
      activeCaseId: settings.activeCaseId,
      storageUsage: storage.usage,
      storageQuota: storage.quota,
      // Do not probe Mistral on init — status stays IDLE until user action
      aiStatus: typeof navigator !== 'undefined' && !navigator.onLine ? 'OFFLINE' : 'IDLE',
    })
    if (settings.activeCaseId) {
      await get().selectCase(settings.activeCaseId)
    }
  },

  enterSandbox: () => {
    patchSettings({ enteredSandbox: true })
    set({ enteredSandbox: true })
  },

  createCase: async (input) => {
    const settings = loadSettings()
    const now = new Date().toISOString()
    const seq = (await localCaseRepository.list()).length + 1
    const record: CaseRecord = {
      id: createId('case'),
      workspaceId: settings.workspaceId,
      name:
        input?.name ??
        t('case.defaultName', { seq: String(seq).padStart(3, '0') }),
      reference: `FX-${String(seq).padStart(3, '0')}`,
      description: input?.description ?? '',
      createdAt: now,
      updatedAt: now,
      status: 'ACTIVE',
      classification: 'INTERNAL',
      tags: [],
    }
    await localCaseRepository.put(record)
    await localAuditRepository.append({
      id: createId('audit'),
      caseId: record.id,
      workspaceId: record.workspaceId,
      type: 'CASE_CREATED',
      createdAt: now,
      message: t('audit.caseCreated', { reference: record.reference }),
    })
    patchSettings({ activeCaseId: record.id })
    const cases = await localCaseRepository.list()
    set({ cases, activeCaseId: record.id })
    await get().refreshCaseData()
    return record
  },

  selectCase: async (caseId) => {
    patchSettings({ activeCaseId: caseId })
    set({ activeCaseId: caseId, selectedEvidenceIds: [] })
    await get().refreshCaseData()
  },

  refreshCaseData: async () => {
    const caseId = get().activeCaseId
    if (!caseId) {
      set({
        evidence: [],
        findings: [],
        entities: [],
        timelineEvents: [],
        auditEvents: [],
        aiRuns: [],
      })
      return
    }
    const [evidence, findings, entities, timelineEvents, auditEvents, aiRuns, storage] =
      await Promise.all([
        localEvidenceRepository.listByCase(caseId),
        localFindingRepository.listByCase(caseId),
        localEntityRepository.listByCase(caseId),
        localTimelineRepository.listByCase(caseId),
        localAuditRepository.listByCase(caseId),
        localAiRunRepository.listByCase(caseId),
        estimateStorage(),
      ])
    set({
      evidence,
      findings,
      entities,
      timelineEvents,
      auditEvents,
      aiRuns,
      storageUsage: storage.usage,
      storageQuota: storage.quota,
    })
  },

  setSelectedEvidence: (ids) => set({ selectedEvidenceIds: ids }),

  toggleEvidenceSelection: (id) => {
    const current = get().selectedEvidenceIds
    if (current.includes(id)) {
      set({ selectedEvidenceIds: current.filter((x) => x !== id) })
    } else {
      set({ selectedEvidenceIds: [...current, id] })
    }
  },

  importEvidence: async (files) => {
    let caseId = get().activeCaseId
    if (!caseId) {
      const created = await get().createCase()
      caseId = created.id
    }
    set({ ingestBusy: true, statusMessage: t('status.importing') })
    try {
      const results = await ingestFiles(files, {
        caseId,
        workspaceId: get().workspaceId,
      })
      await get().refreshCaseData()
      if (results[0]) {
        set({ selectedEvidenceIds: [results[0].evidence.id] })
      }
      const { storageUsage, storageQuota } = get()
      const nearLimit =
        storageQuota > 0 && storageUsage / storageQuota > 0.8
      set({
        statusMessage: nearLimit
          ? t('status.storageNearLimit')
          : t('status.imported', { count: results.length }),
      })
    } finally {
      set({ ingestBusy: false })
    }
  },

  setLeftTab: (tab) => set({ leftTab: tab }),
  setCommandOpen: (open) => set({ commandOpen: open }),
  setAuditOpen: (open) => set({ auditOpen: open }),
  setMobilePanel: (panel) => set({ mobilePanel: panel }),

  refreshAiStatus: async () => {
    const aiStatus = await probeAiStatus()
    set({ aiStatus })
  },

  setAiBusy: (busy, error = null) => set({ aiBusy: busy, aiError: error }),
  setStatusMessage: (message) => set({ statusMessage: message }),
}))
