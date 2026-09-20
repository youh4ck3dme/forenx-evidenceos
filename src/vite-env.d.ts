/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_AI_MODE?: 'auto' | 'mock' | 'http'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
