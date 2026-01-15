'use server';

import { getDb } from '@/lib/db';
import { getCurrentUser } from './auth';
import { MandalartData, HistoryItem } from '@/types';

export const getHistory = async (): Promise<HistoryItem[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const sql = getDb();
  const mandalarts = await sql`
    SELECT id, user_id, main_goal, sub_goals, created_at as timestamp
    FROM mandalarts 
    WHERE user_id = ${user.id}
    ORDER BY created_at DESC
  ` as any[];

  return mandalarts.map(m => ({
    id: m.id,
    userId: m.user_id,
    timestamp: new Date(m.timestamp).getTime(),
    data: {
      mainGoal: m.main_goal,
      subGoals: m.sub_goals
    }
  }));
};

export const saveMandalart = async (data: MandalartData): Promise<HistoryItem> => {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const sql = getDb();
  const results = await sql`
    INSERT INTO mandalarts (user_id, main_goal, sub_goals)
    VALUES (${user.id}, ${data.mainGoal}, ${data.subGoals as any})
    RETURNING id, user_id, created_at as timestamp
  ` as any[];

  const result = results[0];

  return {
    id: result.id,
    userId: result.user_id,
    timestamp: new Date(result.timestamp).getTime(),
    data
  };
};

export const updateMandalart = async (id: string, data: MandalartData): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const sql = getDb();
  await sql`
    UPDATE mandalarts
    SET main_goal = ${data.mainGoal},
        sub_goals = ${data.subGoals as any},
        updated_at = NOW()
    WHERE id = ${id} AND user_id = ${user.id}
  `;
};

export const deleteMandalart = async (id: string): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const sql = getDb();
  await sql`
    DELETE FROM mandalarts
    WHERE id = ${id} AND user_id = ${user.id}
  `;
};
