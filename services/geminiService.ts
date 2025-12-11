import { GoogleGenAI, Type, Schema } from "@google/genai";
import { MandalartData, Question, InterviewAnswer } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

export const generateQuestions = async (mainGoal: string): Promise<Question[]> => {
  const prompt = `
    O usuário tem o seguinte objetivo principal: "${mainGoal}".
    Gere exatamente 3 perguntas curtas e estratégicas para entender melhor como o usuário pretende alcançar esse objetivo, quais são suas prioridades ou contexto específico.
    Essas perguntas ajudarão a criar um plano de ação detalhado (Mandalart) depois.
    Retorne apenas as perguntas.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING },
          },
          required: ["id", "text"],
        },
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text) as Question[];
};

export const generateMandalartData = async (
  mainGoal: string,
  answers: InterviewAnswer[]
): Promise<MandalartData> => {
  
  const context = answers.map(a => `P: ${a.questionText}\nR: ${a.answer}`).join('\n');

  const prompt = `
    Crie uma estrutura de Mandalart (Matriz 9x9) para o objetivo principal: "${mainGoal}".
    
    Considere o contexto fornecido pelo usuário:
    ${context}

    REGRAS ESTRITAS:
    1. O objetivo principal é o centro.
    2. Identifique exatamente 8 sub-objetivos (áreas chave) para alcançar o objetivo principal.
    3. Para CADA um dos 8 sub-objetivos, liste exatamente 8 tarefas ou comportamentos acionáveis.
    4. Seja conciso. Use palavras-chave ou frases curtas (máximo 4-5 palavras por item).
    
    A saída deve seguir estritamente o schema JSON fornecido.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      mainGoal: { type: Type.STRING, description: "O objetivo central definido pelo usuário" },
      subGoals: {
        type: Type.ARRAY,
        description: "Exatamente 8 sub-objetivos que cercam o objetivo principal",
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Título curto do sub-objetivo" },
            tasks: {
              type: Type.ARRAY,
              description: "Exatamente 8 ações para este sub-objetivo",
              items: { type: Type.STRING }
            }
          },
          required: ["title", "tasks"]
        }
      }
    },
    required: ["mainGoal", "subGoals"]
  };

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");

  const data = JSON.parse(text) as MandalartData;

  // Validation fallback: Ensure we have exactly 8 subgoals and 8 tasks each to avoid grid breakage
  if (data.subGoals.length < 8) {
    // Fill with empty placeholders if AI fails to generate enough
    while (data.subGoals.length < 8) {
        data.subGoals.push({ title: "...", tasks: Array(8).fill("...") });
    }
  }
  
  data.subGoals = data.subGoals.slice(0, 8); // Trim if too many
  
  data.subGoals.forEach(sg => {
      if (sg.tasks.length < 8) {
          while(sg.tasks.length < 8) sg.tasks.push("...");
      }
      sg.tasks = sg.tasks.slice(0, 8);
  });

  return data;
};
