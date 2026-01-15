import { neon } from '@neondatabase/serverless';

let sql: ReturnType<typeof neon> | null = null;

export const getDb = () => {
  if (!sql) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }
    sql = neon(databaseUrl);
  }
  return sql;
};
