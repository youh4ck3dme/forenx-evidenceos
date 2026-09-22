/** Default Malte detection rule pack — explainable weights (sum need not be 100). */
export const MALTE_RULE_VERSION = "malte-rules-v1.0.0";

export const DEFAULT_WEIGHTS = {
  shellCompany: 28,
  transactionAnomaly: 18,
  licenseSerial: 16,
  networkChain: 14,
  crossBorder: 12,
  highValueBurst: 12,
} as const;

export const DEFAULT_THRESHOLDS = {
  alertMinScore: 35,
  highValueAmount: 10_000,
  shellNameHints: [
    "s.r.o.",
    "ltd",
    "offshore",
    "shell",
    "holding",
    "consulting",
    "trading",
    "babcan",
    "babčan",
  ],
} as const;
