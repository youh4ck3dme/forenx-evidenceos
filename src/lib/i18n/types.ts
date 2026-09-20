export type Locale = 'sk' | 'en'

export type MessageKey = keyof typeof import('./locales/en').en

export type Messages = Record<MessageKey, string>
