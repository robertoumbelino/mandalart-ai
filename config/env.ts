import { z } from 'zod'

const envSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY é obrigatória'),
  OPENROUTER_MODEL_NAME: z
    .string()
    .min(1, 'OPENROUTER_MODEL_NAME é obrigatória')
})

const parseEnv = () => {
  const env = {
    OPENROUTER_API_KEY: import.meta.env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL_NAME: import.meta.env.OPENROUTER_MODEL_NAME
  }

  const result = envSchema.safeParse(env)

  if (!result.success) {
    const errors = result.error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Erro na validação das variáveis de ambiente:\n${errors}`)
  }

  return result.data
}

export const env = parseEnv()
