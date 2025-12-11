export interface SubGoal {
  title: string;
  tasks: string[]; // Should be exactly 8 items
}

export interface MandalartData {
  mainGoal: string;
  subGoals: SubGoal[]; // Should be exactly 8 items
}

export interface Question {
  id: string;
  text: string;
}

export type AppStep = 'input' | 'interview' | 'generating' | 'result';

export interface InterviewAnswer {
  questionId: string;
  questionText: string;
  answer: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  data: MandalartData;
}