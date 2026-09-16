export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface TaskItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface Task {
  title: string;
  description: string;
  advice: string;
  checklist: TaskItem[];
  isCompleted: boolean;
}

export interface SubGoal {
  title: string;
  description: string; 
  advice: string; 
  tasks: Task[];
}

export interface MandalartData {
  mainGoal: string;
  subGoals: SubGoal[]; 
}

export interface Question {
  id: string;
  text: string;
}

export type GoalSafetyCategory = 'illegal' | 'self-harm';

export type QuestionGenerationResult =
  | { status: 'allowed'; questions: Question[] }
  | { status: 'blocked'; category: GoalSafetyCategory };

export type AppStep = 'input' | 'safety' | 'interview' | 'generating' | 'result';

export interface InterviewAnswer {
  questionId: string;
  questionText: string;
  answer: string;
}

export interface HistoryItem {
  id: string;
  userId: string;
  timestamp: number;
  data: MandalartData;
}
