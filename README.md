# Mandalart.AI

Aplicação que transforma um objetivo em uma matriz Mandalart 9×9: 8 subobjetivos, cada um com 8 tarefas e checklists acionáveis.

## Stack

- Next.js 16 e React 19
- Vercel AI SDK 7 com Vercel AI Gateway
- `openai/gpt-5.6-luna` como modelo padrão de bom custo-benefício
- Neon Postgres com `@neondatabase/serverless`
- Tailwind CSS 4
- Zod, JWT e bcrypt

O OpenRouter foi removido. As chamadas de IA são Server Actions, portanto credenciais e prompts não entram no bundle do navegador. Em deploys na Vercel, o Gateway usa o token OIDC do próprio projeto; uma `AI_GATEWAY_API_KEY` só é necessária quando o desenvolvimento local não usa `vercel dev`.

## Desenvolvimento local

Requisitos: Node.js 22.18 ou superior e pnpm 10.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Preencha `.env` com uma conexão Neon válida e um `JWT_SECRET` aleatório de pelo menos 32 caracteres. Para autenticação local do Gateway, use `vercel env pull`/`vercel dev` ou crie uma chave do AI Gateway.

Antes da primeira execução, aplique [migrations/001_initial_schema.sql](./migrations/001_initial_schema.sql) em uma conexão direta do Neon. O runtime pode usar a URL com pooler.

## Qualidade

```bash
pnpm check
pnpm build
```

`check` executa ESLint, TypeScript e testes Vitest.

## Variáveis de ambiente

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `DATABASE_URL` | Sim | Conexão do Neon |
| `JWT_SECRET` | Sim | Assinatura das sessões; mínimo de 32 caracteres |
| `AI_MODEL_NAME` | Não | Padrão: `openai/gpt-5.6-luna` |
| `AI_GATEWAY_API_KEY` | Apenas local, se necessário | Autenticação do Gateway fora do OIDC da Vercel |

## Deploy na Vercel

Vincule o repositório, configure `DATABASE_URL`, `JWT_SECRET` e `AI_MODEL_NAME`, e execute:

```bash
vercel --prod
```

Depois, confirme `GET /api/health` (banco) e faça um fluxo completo de cadastro e geração. Configure também um limite de gasto no painel do AI Gateway.

## Segurança

- Sessões usam cookies `HttpOnly`, `Secure` em produção e `SameSite=Lax`.
- Todas as mutações validam sessão, UUID e payload no servidor.
- A saída do modelo é validada por schema antes de ser persistida.
- Se uma credencial já apareceu no histórico Git, remova/rotacione a credencial no provedor; editar apenas o arquivo atual não revoga o segredo.
