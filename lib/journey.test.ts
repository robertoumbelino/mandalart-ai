import { describe, expect, it } from 'vitest'
import { getJourneyProgress } from './journey'
import type { MandalartData } from '@/types'

const buildPlan = (): MandalartData => ({
  mainGoal: 'Completar a jornada',
  subGoals: Array.from({ length: 8 }, (_, subGoalIndex) => ({
    title: `Capítulo ${subGoalIndex + 1}`,
    description: 'Descrição',
    advice: 'Conselho',
    tasks: Array.from({ length: 8 }, (_, taskIndex) => ({
      title: `Tarefa ${taskIndex + 1}`,
      description: 'Descrição',
      advice: 'Conselho',
      checklist: Array.from({ length: 3 }, (_, itemIndex) => ({
        id: `${subGoalIndex}-${taskIndex}-${itemIndex}`,
        text: `Ação ${itemIndex + 1}`,
        checked: false
      })),
      isCompleted: false
    }))
  }))
})

describe('journey progress', () => {
  it('starts at the first task with zero progress', () => {
    const progress = getJourneyProgress(buildPlan())

    expect(progress.percentage).toBe(0)
    expect(progress.totalTasks).toBe(64)
    expect(progress.totalItems).toBe(192)
    expect(progress.nextTask).toMatchObject({
      subGoalIndex: 0,
      taskIndex: 0,
      stepNumber: 1
    })
  })

  it('tracks partial checklist progress and advances to the first unfinished task', () => {
    const plan = buildPlan()
    plan.subGoals[0].tasks[0].checklist.forEach(item => { item.checked = true })
    plan.subGoals[0].tasks[0].isCompleted = true
    plan.subGoals[0].tasks[1].checklist[0].checked = true

    const progress = getJourneyProgress(plan)

    expect(progress.completedTasks).toBe(1)
    expect(progress.completedItems).toBe(4)
    expect(progress.percentage).toBe(2)
    expect(progress.nextTask).toMatchObject({ taskIndex: 1, stepNumber: 2 })
    expect(progress.stages[0].percentage).toBe(17)
  })

  it('returns no next task when the full journey is complete', () => {
    const plan = buildPlan()
    plan.subGoals.forEach(subGoal => subGoal.tasks.forEach(task => {
      task.checklist.forEach(item => { item.checked = true })
      task.isCompleted = true
    }))

    const progress = getJourneyProgress(plan)

    expect(progress.percentage).toBe(100)
    expect(progress.completedTasks).toBe(64)
    expect(progress.nextTask).toBeNull()
  })
})
