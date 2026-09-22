export type Locale = "sk" | "en";

export const messages = {
  "case.mode.evidence": true,
  "case.mode.malte": true,
  "audit.intro": true,
} as const;

export type MessageKey = keyof typeof messages;
export type Messages = Record<MessageKey, string>;
