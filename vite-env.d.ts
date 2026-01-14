/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly OPENROUTER_API_KEY: string
  readonly OPENROUTER_MODEL_NAME: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
