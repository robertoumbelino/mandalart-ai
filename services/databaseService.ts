import { MandalartData, HistoryItem } from '../types';

const HISTORY_KEY = 'mandalart_db_history';

export const db = {
  getHistory: (userId: string): HistoryItem[] => {
    const allHistory: HistoryItem[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return allHistory.filter(item => item.userId === userId);
  },

  saveMandalart: (userId: string, data: MandalartData): HistoryItem => {
    const allHistory: HistoryItem[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      userId,
      timestamp: Date.now(),
      data
    };
    
    const updatedHistory = [newItem, ...allHistory];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
    return newItem;
  },

  updateMandalart: (id: string, data: MandalartData) => {
    const allHistory: HistoryItem[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const index = allHistory.findIndex(item => item.id === id);
    if (index !== -1) {
      allHistory[index].data = data;
      localStorage.setItem(HISTORY_KEY, JSON.stringify(allHistory));
    }
  },

  deleteMandalart: (id: string) => {
    const allHistory: HistoryItem[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const filtered = allHistory.filter(item => item.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
  }
};