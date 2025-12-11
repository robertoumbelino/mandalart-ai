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
  rawInput: string,
  answers: InterviewAnswer[]
): Promise<MandalartData> => {
  
  const context = answers.map(a => `P: ${a.questionText}\nR: ${a.answer}`).join('\n');

  const prompt = `
    O usuário digitou o seguinte desejo/objetivo: "${rawInput}".
    Contexto adicional da entrevista:
    ${context}

    Crie uma estrutura de Mandalart (Matriz 9x9).

    REGRAS ESTRITAS:
    1. **mainGoal**: Título curto (máx 4 palavras).
    2. **subGoals**: Exatamente 8 áreas chave.
       - **description**: Uma frase curta explicando O QUE é e POR QUE é importante.
       - **advice**: Uma dica prática ou conselho de "ouro" sobre como melhorar nessa área específica.
    3. **tasks**: Exatamente 8 ações práticas para cada sub-objetivo.
    
    A saída deve seguir estritamente o schema JSON fornecido.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      mainGoal: { type: Type.STRING, description: "Título curto do objetivo principal." },
      subGoals: {
        type: Type.ARRAY,
        description: "Exatamente 8 sub-objetivos",
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Título curto do sub-objetivo" },
            description: { type: Type.STRING, description: "Explicação breve do sub-objetivo" },
            advice: { type: Type.STRING, description: "Uma sugestão ou dica de como melhorar" },
            tasks: {
              type: Type.ARRAY,
              description: "Exatamente 8 ações",
              items: { type: Type.STRING }
            }
          },
          required: ["title", "description", "advice", "tasks"]
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

  // Validation fallback
  if (data.subGoals.length < 8) {
    while (data.subGoals.length < 8) {
        data.subGoals.push({ 
          title: "...", 
          description: "...",
          advice: "...",
          tasks: Array(8).fill("...") 
        });
    }
  }
  
  data.subGoals = data.subGoals.slice(0, 8);
  
  data.subGoals.forEach(sg => {
      if (!sg.description) sg.description = `Foco em ${sg.title}`;
      if (!sg.advice) sg.advice = "Mantenha a constância.";
      if (sg.tasks.length < 8) {
          while(sg.tasks.length < 8) sg.tasks.push("...");
      }
      sg.tasks = sg.tasks.slice(0, 8);
  });

  return data;
};