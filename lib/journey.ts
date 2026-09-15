import type { MandalartData, Task } from '@/types'

export interface JourneyTaskReference {
  task: Task
  subGoalIndex: number
  taskIndex: number
  stepNumber: number
}

export interface JourneyStageProgress {
  completedTasks: number
  completedItems: number
  totalTasks: number
  totalItems: number
  percentage: number
}

export interface JourneyProgress {
  completedTasks: number
  completedItems: number
  totalTasks: number
  totalItems: number
  percentage: number
  nextTask: JourneyTaskReference | null
  currentStageIndex: number
  stages: JourneyStageProgress[]
}

const percentage = (completed: number, total: number) =>
  total === 0 ? 0 : Math.round((completed / total) * 100)

export const getJourneyProgress = (data: MandalartData): JourneyProgress => {
  let completedTasks = 0
  let completedItems = 0
  let totalTasks = 0
  let totalItems = 0
  let nextTask: JourneyTaskReference | null = null

  const stages = data.subGoals.map((subGoal, subGoalIndex) => {
    let stageCompletedTasks = 0
    let stageCompletedItems = 0
    let stageTotalItems = 0

    subGoal.tasks.forEach((task, taskIndex) => {
      const checkedItems = task.checklist.filter(item => item.checked).length
      const isComplete = task.isCompleted || (
        task.checklist.length > 0 && checkedItems === task.checklist.length
      )

      totalTasks += 1
      totalItems += task.checklist.length
      completedItems += checkedItems
      stageTotalItems += task.checklist.length
      stageCompletedItems += checkedItems

      if (isComplete) {
        completedTasks += 1
        stageCompletedTasks += 1
      } else if (!nextTask) {
        nextTask = {
          task,
          subGoalIndex,
          taskIndex,
          stepNumber: totalTasks
        }
      }
    })

    return {
      completedTasks: stageCompletedTasks,
      completedItems: stageCompletedItems,
      totalTasks: subGoal.tasks.length,
      totalItems: stageTotalItems,
      percentage: percentage(stageCompletedItems, stageTotalItems)
    }
  })

  return {
    completedTasks,
    completedItems,
    totalTasks,
    totalItems,
    percentage: percentage(completedItems, totalItems),
    nextTask,
    currentStageIndex: nextTask?.subGoalIndex ?? Math.max(data.subGoals.length - 1, 0),
    stages
  }
}
