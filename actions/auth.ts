'use server';

import { getDb } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { User } from '@/types';

const TOKEN_COOKIE = 'mandalart_token';

export const login = async (email: string, password: string): Promise<User> => {
  const sql = getDb();
  const users = await sql`
    SELECT * FROM users WHERE email = ${email}
  ` as any[];

  const user = users[0];

  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    const newUsers = await sql`
      INSERT INTO users (email, name, password_hash, avatar)
      VALUES (${email}, ${email.split('@')[0]}, ${passwordHash}, 
              ${`https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`})
      RETURNING id, email, name, avatar
    ` as any[];

    const newUser = newUsers[0];

    const token = jwt.sign({ userId: newUser.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    const cookieStore = await cookies();
    cookieStore.set(TOKEN_COOKIE, token);

    return {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      avatar: newUser.avatar
    };
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw new Error('Invalid password');
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  const cookieStore = await cookies();
  cookieStore.set(TOKEN_COOKIE, token);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar
  };
};

export const loginWithGoogle = async (): Promise<User> => {
  const sql = getDb();
  const googleEmail = 'user@google.com';
  
  const users = await sql`
    SELECT * FROM users WHERE email = ${googleEmail}
  ` as any[];

  let user = users[0];

  if (!user) {
    const newUsers = await sql`
      INSERT INTO users (email, name, avatar)
      VALUES (${googleEmail}, 'Usuário Google', 
              'https://api.dicebear.com/7.x/avataaars/svg?seed=google')
      RETURNING id, email, name, avatar
    ` as any[];

    user = newUsers[0];
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  const cookieStore = await cookies();
  cookieStore.set(TOKEN_COOKIE, token);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar
  };
};

export const getCurrentUser = async (): Promise<User | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const sql = getDb();
    const users = await sql`
      SELECT id, email, name, avatar FROM users WHERE id = ${decoded.userId}
    ` as any[];

    const user = users[0];
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar
    };
  } catch {
    return null;
  }
};

export const logout = async () => {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE);
};
