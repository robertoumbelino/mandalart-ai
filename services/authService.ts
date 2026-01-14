import { User } from '../types';

const USERS_KEY = 'mandalart_users';
const SESSION_KEY = 'mandalart_current_user';

export const authService = {
  login: async (email: string, password: string): Promise<User> => {
    // Simulação de delay de rede
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const users: User[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const user = users.find(u => u.email === email);
    
    if (!user) {
      // Se não existe, criamos um para facilitar o teste inicial (mock)
      const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        name: email.split('@')[0],
        email: email,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
      };
      users.push(newUser);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
      return newUser;
    }
    
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return user;
  },

  loginWithGoogle: async (): Promise<User> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const googleUser: User = {
      id: 'google_123',
      name: 'Usuário Google',
      email: 'user@google.com',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=google'
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(googleUser));
    return googleUser;
  },

  getCurrentUser: (): User | null => {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
  }
};