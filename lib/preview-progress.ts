import { z } from 'zod'

export const previewProgressSchema = z.array(z.boolean()).length(3)
export function previewProgress(value: unknown): boolean[] {
  const result = previewProgressSchema.safeParse(value)
  return result.success ? result.data : [false, false, false]
}
