import type {
  AuditType,
  CaseStatus,
  Classification,
  DetectedKind,
  EpistemicClass,
  EvidenceSection,
  EvidenceStatus,
  IngestLane,
  ReviewStatus,
} from "@/domain/types";

export function skCount(n: number, one: string, few: string, many: string): string {
  if (n === 1) return `${n} ${one}`;
  if (n >= 2 && n <= 4) return `${n} ${few}`;
  return `${n} ${many}`;
}

export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  PUBLIC: "Verejné",
  INTERNAL: "Interné",
  CONFIDENTIAL: "Dôverné",
  RESTRICTED: "Obmedzené",
};

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  OPEN: "Otvorený",
  ACTIVE: "Aktívny",
  CLOSED: "Uzavretý",
  ARCHIVED: "Archivovaný",
};

export const EVIDENCE_STATUS_LABEL: Record<EvidenceStatus, string> = {
  IMPORTED: "Vložené",
  HASHED: "Zahashované",
  EXTRACTED: "Extrahované",
  ANALYZED: "Analyzované",
  QUARANTINED: "V karanténe",
};

export const SECTION_LABEL: Record<EvidenceSection, string> = {
  IDENTITY: "Identita",
  COMMUNICATION: "Komunikácia",
  FINANCIAL: "Financie",
  CONTRACT: "Zmluvy",
  TECHNICAL: "Technické",
  MEDIA: "Médiá",
  TIMELINE: "Časová os",
  LEGAL_DOCUMENT: "Právny dokument",
  ADMINISTRATIVE: "Administratíva",
  LOCATION: "Miesto",
  OTHER: "Ostatné",
};

export const EPISTEMIC_LABEL: Record<EpistemicClass, string> = {
  OBSERVED: "Pozorované",
  DERIVED: "Odvodené",
  INFERRED: "Usúdené",
  HYPOTHESIS: "Hypotéza",
  UNKNOWN: "Neznáme",
};

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  PENDING: "Čaká",
  ACCEPTED: "Prijaté",
  REJECTED: "Odmietnuté",
  NEEDS_REVIEW: "Na kontrolu",
};

export const AUDIT_TYPE_LABEL: Record<AuditType, string> = {
  CASE_CREATED: "Prípad vytvorený",
  EVIDENCE_IMPORTED: "Dôkaz vložený",
  EVIDENCE_HASHED: "Dôkaz zahashovaný",
  EVIDENCE_SELECTED: "Dôkaz vybraný",
  EXTRACTION_CREATED: "Text extrahovaný",
  AI_ANALYSIS_STARTED: "Analýza spustená",
  AI_ANALYSIS_COMPLETED: "Analýza dokončená",
  AI_ANALYSIS_FAILED: "Analýza zlyhala",
  FINDING_REVIEWED: "Zistenie posúdené",
  EXPORT_CREATED: "Export vytvorený",
  MALTE_IMPORT: "Malte import",
  MALTE_DETECTION_RUN: "Malte detekcia",
  MALTE_ALERT_REVIEWED: "Malte posúdenie",
  MALTE_REPORT_EXPORTED: "Malte správa",
  MALTE_WEIGHTS_UPDATED: "Malte váhy",
};

export const LANE_LABEL: Record<IngestLane, string> = {
  NATIVE: "Pôvodné",
  NORMALIZE: "Normalizované",
  QUARANTINE: "Karanténa",
};

export const KIND_LABEL: Record<DetectedKind, string> = {
  pdf: "PDF",
  image: "Obrázok",
  docx: "DOCX",
  rtf: "RTF",
  markdown: "Markdown",
  text: "Text",
  csv: "CSV",
  json: "JSON",
  xml: "XML",
  html: "HTML",
  unknown: "Neznámy",
  executable: "Spustiteľný súbor",
};

export const RUN_STATUS_LABEL: Record<string, string> = {
  STARTED: "Spustené",
  COMPLETED: "Dokončené",
  FAILED: "Zlyhalo",
  CANCELLED: "Zrušené",
};

export const SECTION_SOURCE_LABEL: Record<string, string> = {
  DEFAULT: "predvolené",
  AI: "AI",
  HUMAN: "ručne",
};

export const ENTITY_TYPE_LABEL: Record<string, string> = {
  PERSON: "Osoba",
  ORGANIZATION: "Organizácia",
  EMAIL: "E-mail",
  PHONE: "Telefón",
  ADDRESS: "Adresa",
  LOCATION: "Miesto",
  DOMAIN: "Doména",
  URL: "URL",
  IP_ADDRESS: "IP adresa",
  DEVICE: "Zariadenie",
  ACCOUNT: "Účet",
  BANK_ACCOUNT: "Bankový účet",
  CRYPTO_ADDRESS: "Kryptoadresa",
  VEHICLE: "Vozidlo",
  DOCUMENT_ID: "Identifikátor dokumentu",
  TRANSACTION_ID: "Identifikátor transakcie",
  USERNAME: "Používateľské meno",
  SOCIAL_ACCOUNT: "Sociálny účet",
  DATE: "Dátum",
  OTHER_IDENTIFIER: "Iný identifikátor",
};

export function enumLabel(map: Record<string, string>, value: string): string {
  return map[value] ?? value.replaceAll("_", " ");
}
