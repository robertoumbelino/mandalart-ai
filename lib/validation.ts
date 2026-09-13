import { z } from 'zod'

const shortText = z.string().trim().min(1).max(120)
const detailText = z.string().trim().min(1).max(400)
const gridTitle = z.string().trim().min(2).max(40)

export const compactGoalTitleSchema = z.string().trim().min(3).max(32)

export const goalSchema = z.string().trim().min(3).max(300)

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(72)
})

export const idSchema = z.string().uuid()

export const questionSchema = z.object({
  id: z.string().trim().min(1).max(40),
  text: detailText
})

export const questionsOutputSchema = z.object({
  questions: z.array(questionSchema).length(3)
})

export const interviewAnswerSchema = z.object({
  questionId: z.string().trim().min(1).max(40),
  questionText: detailText,
  answer: z.string().trim().min(1).max(1_000)
})

const generatedTaskSchema = z.object({
  title: gridTitle,
  description: detailText,
  advice: detailText,
  checklist: z.array(shortText).length(3)
})

export const generatedMandalartSchema = z.object({
  mainGoal: compactGoalTitleSchema,
  subGoals: z.array(
    z.object({
      title: gridTitle,
      description: detailText,
      advice: detailText,
      tasks: z.array(generatedTaskSchema).length(8)
    })
  ).length(8)
})

export const mandalartDataSchema = z.object({
  mainGoal: goalSchema,
  subGoals: z.array(
    z.object({
      title: shortText,
      description: detailText,
      advice: detailText,
      tasks: z.array(
        z.object({
          title: shortText,
          description: detailText,
          advice: detailText,
          checklist: z.array(
            z.object({
              id: z.string().trim().min(1).max(100),
              text: shortText,
              checked: z.boolean()
            })
          ).length(3),
          isCompleted: z.boolean()
        })
      ).length(8)
    })
  ).length(8)
})
