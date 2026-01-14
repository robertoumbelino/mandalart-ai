import { generateText } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { z } from 'zod'
import { MandalartData, Question, InterviewAnswer } from '../types'
import { env } from '../config/env'

const openrouter = createOpenRouter({
  apiKey: env.OPENROUTER_API_KEY
})

const questionsSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      text: z.string()
    })
  )
})

const taskSchema = z.object({
  title: z.string(),
  description: z.string(),
  advice: z.string()
})

const subGoalSchema = z.object({
  title: z.string(),
  description: z.string(),
  advice: z.string(),
  tasks: z.array(taskSchema)
})

const mandalartSchema = z.object({
  mainGoal: z.string(),
  subGoals: z.array(subGoalSchema)
})

const extractJson = (text: string): string => {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Nenhum JSON encontrado na resposta')
  }
  return jsonMatch[0]
}

export const generateQuestions = async (
  mainGoal: string
): Promise<Question[]> => {
  console.log('[OpenRouter] Gerando perguntas para:', mainGoal)

  const { text } = await generateText({
    model: openrouter(env.OPENROUTER_MODEL_NAME),
    prompt: `Você é um assistente que ajuda pessoas a planejar seus objetivos.
Sempre responda APENAS com JSON válido, sem texto adicional.

O usuário tem o seguinte objetivo principal: "${mainGoal}".

Gere exatamente 3 perguntas curtas e estratégicas para entender melhor como o usuário pretende alcançar esse objetivo.

Responda APENAS com JSON neste formato:
{"questions":[{"id":"1","text":"Pergunta 1?"},{"id":"2","text":"Pergunta 2?"},{"id":"3","text":"Pergunta 3?"}]}`
  })

  console.log('[OpenRouter] Resposta recebida:', text.substring(0, 200))

  const jsonString = extractJson(text)
  const parsed = JSON.parse(jsonString)
  const validated = questionsSchema.parse(parsed)

  console.log('[OpenRouter] Perguntas validadas:', validated.questions)

  return validated.questions
}

export const generateMandalartData = async (
  rawInput: string,
  answers: InterviewAnswer[]
): Promise<MandalartData> => {
  const context = answers
    .map(answer => `P: ${answer.questionText}\nR: ${answer.answer}`)
    .join('\n')

  console.log('[OpenRouter] Gerando Mandalart para:', rawInput)

  const { text } = await generateText({
    model: openrouter(env.OPENROUTER_MODEL_NAME),
    prompt: `Você é um especialista em planejamento de metas usando a técnica Mandalart.
Sempre responda APENAS com JSON válido, sem texto adicional.

Objetivo: "${rawInput}"
Contexto: ${context}

Gere JSON com mainGoal e 8 subGoals. Cada subGoal tem title, description, advice e 8 tasks. Cada task tem title, description, advice.

Seja MUITO breve. Max 4 palavras por campo.

Responda APENAS com JSON:
{"mainGoal":"X","subGoals":[{"title":"A","description":"B","advice":"C","tasks":[{"title":"T","description":"D","advice":"A"},...]},...]}
`
  })

  console.log('[OpenRouter] Resposta recebida:', text.substring(0, 300))

  const jsonString = extractJson(text)
  const parsed = JSON.parse(jsonString)
  const validated = mandalartSchema.parse(parsed)

  console.log('[OpenRouter] Mandalart validado:', validated.mainGoal)

  const defaultChecklist = ['Planejar', 'Executar', 'Revisar']

  const data: MandalartData = {
    mainGoal: validated.mainGoal,
    subGoals: validated.subGoals.slice(0, 8).map(subGoal => ({
      title: subGoal.title,
      description: subGoal.description,
      advice: subGoal.advice,
      tasks: subGoal.tasks.slice(0, 8).map((task, taskIndex) => ({
        title: task.title,
        description: task.description,
        advice: task.advice,
        isCompleted: false,
        checklist: defaultChecklist.map((item, index) => ({
          id: `chk-${Date.now()}-${Math.random()}-${taskIndex}-${index}`,
          text: item,
          checked: false
        }))
      }))
    }))
  }

  return data
}
