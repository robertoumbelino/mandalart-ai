'use server'

import { getCurrentUser } from '@/actions/auth'
import { getDb } from '@/lib/db'
import { idSchema, mandalartDataSchema } from '@/lib/validation'
import type { HistoryItem, MandalartData } from '@/types'

type MandalartRow = {
  id: string
  user_id: string
  main_goal: string
  sub_goals: unknown
  timestamp: Date | string
}

const requireUser = async () => {
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para continuar.')
  return user
}

export const getHistory = async (): Promise<HistoryItem[]> => {
  const user = await getCurrentUser()
  if (!user) return []

  const sql = getDb()
  const rows = await sql`
    SELECT id, user_id, main_goal, sub_goals, created_at AS timestamp
    FROM mandalarts
    WHERE user_id = ${user.id}
    ORDER BY created_at DESC
    LIMIT 100
  ` as MandalartRow[]

  return rows.flatMap(row => {
    const parsed = mandalartDataSchema.safeParse({
      mainGoal: row.main_goal,
      subGoals: row.sub_goals
    })
    if (!parsed.success) return []

    return [{
      id: row.id,
      userId: row.user_id,
      timestamp: new Date(row.timestamp).getTime(),
      data: parsed.data
    }]
  })
}

export const updateMandalart = async (rawId: string, rawData: MandalartData): Promise<void> => {
  const user = await requireUser()
  const id = idSchema.parse(rawId)
  const data = mandalartDataSchema.parse(rawData)
  const subGoals = JSON.stringify(data.subGoals)
  const sql = getDb()
  const rows = await sql`
    UPDATE mandalarts
    SET main_goal = ${data.mainGoal},
        sub_goals = ${subGoals}::jsonb,
        updated_at = NOW()
    WHERE id = ${id} AND user_id = ${user.id}
    RETURNING id
  ` as Array<{ id: string }>

  if (rows.length === 0) throw new Error('Plano não encontrado.')
}

export const deleteMandalart = async (rawId: string): Promise<void> => {
  const user = await requireUser()
  const id = idSchema.parse(rawId)
  const sql = getDb()
  const rows = await sql`
    DELETE FROM mandalarts
    WHERE id = ${id} AND user_id = ${user.id}
    RETURNING id
  ` as Array<{ id: string }>

  if (rows.length === 0) throw new Error('Plano não encontrado.')
}
