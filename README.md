# Mandalart.AI - Planejamento Estratégico com IA

Transforme sonhos vagos em planos de ação concretos. Nossa IA cria uma matriz 9x9 estratégica para guiar seu sucesso.

## 🚀 Tecnologias

- **Next.js 16** - React Framework com App Router
- **Neon PostgreSQL** - Banco de dados serverless (otimizado para Vercel)
- **@neondatabase/serverless** - Driver PostgreSQL para serverless
- **Tailwind CSS v4** - Estilização moderna
- **OpenRouter** - API de IA para geração de planos
- **Server Actions** - Operações do banco de forma segura

## 🏃 Localmente

**Pré-requisitos:**
- Node.js 18+
- pnpm

1. Instalar dependências:
   ```bash
   pnpm install
   ```

2. Configurar variáveis de ambiente (criar `.env`):
   ```env
   DATABASE_URL=postgresql://neondb_owner:npg_i7wL4fySUCzY@ep-falling-lake-ack97uyh-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   JWT_SECRET=sua-chave-secreta-aqui
   OPENROUTER_API_KEY=sua-api-key-do-openrouter
   OPENROUTER_MODEL_NAME=z-ai/glm-4.5-air:free
   ```

3. Executar migration do banco (criar tabelas):
   ```bash
   pnpm tsx scripts/setup-db.ts
   ```

4. Rodar o projeto:
   ```bash
   pnpm dev
   ```

5. Acessar: http://localhost:3000

## 🚀 Deploy na Vercel

1. Push do código para GitHub
2. Importar projeto na Vercel
3. Configurar variáveis de ambiente na Vercel:
   - `DATABASE_URL` - Connection string do Neon
   - `JWT_SECRET` - Chave secreta para JWT
   - `OPENROUTER_API_KEY` - API key do OpenRouter
   - `OPENROUTER_MODEL_NAME` - Modelo da IA (ex: `z-ai/glm-4.5-air:free`)

## 📊 Banco de Dados

### Schema

**Tabela `users`:**
- `id` (UUID, PK)
- `email` (VARCHAR, UNIQUE)
- `name` (VARCHAR)
- `password_hash` (VARCHAR, opcional para Google login)
- `avatar` (TEXT, opcional)
- `created_at` (TIMESTAMP)

**Tabela `mandalarts`:**
- `id` (UUID, PK)
- `user_id` (UUID, FK → users.id, ON DELETE CASCADE)
- `main_goal` (TEXT)
- `sub_goals` (JSONB)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Índices
- `idx_users_email` - Para busca rápida por email
- `idx_mandalarts_user_id` - Para mandalarts do usuário
- `idx_mandalarts_created_at` - Para ordenação por data

## 🔐 Autenticação

- **Senha**: Hash com bcrypt (salt rounds: 10)
- **Sessão**: JWT com expiração de 7 dias
- **Cookies**: HttpOnly, Secure em produção

## 📝 Notas

- Server Actions do Next.js 15+ para operações do banco
- Conexão com Neon via @neondatabase/serverless (otimizado para edge functions)
- Tokens JWT armazenados em cookies HttpOnly
- Todas as operações do banco verificam o `user_id` do token

## 🐛 Debug

### Ver logs do Next.js:
```bash
tail -f /tmp/nextjs.log
```

### Verificar banco de dados:
Acesse o Neon Console para ver as tabelas e dados.

## 📄 Licença

MIT
