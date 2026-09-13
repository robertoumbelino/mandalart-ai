# Mandalart.AI

Aplicação que transforma um objetivo em uma matriz Mandalart 9×9: 8 subobjetivos, cada um com 8 tarefas e checklists acionáveis.

## Stack

- Next.js 16 e React 19
- Vercel AI SDK 7 com Vercel AI Gateway
- `openai/gpt-5.6-luna` como modelo padrão de bom custo-benefício
- Neon Postgres com `@neondatabase/serverless`
- Tailwind CSS 4
- Google Identity Services, Zod, JWT e bcrypt

O OpenRouter foi removido. As chamadas de IA são Server Actions, portanto credenciais e prompts não entram no bundle do navegador. Em deploys na Vercel, o Gateway usa o token OIDC do próprio projeto; uma `AI_GATEWAY_API_KEY` só é necessária quando o desenvolvimento local não usa `vercel dev`.

## Desenvolvimento local

Requisitos: Node.js 22.18 ou superior e pnpm 10.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Preencha `.env` com uma conexão Neon válida e um `JWT_SECRET` aleatório de pelo menos 32 caracteres. Para autenticação local do Gateway, use `vercel env pull`/`vercel dev` ou crie uma chave do AI Gateway.

Antes da primeira execução, aplique, em ordem, as migrations de `migrations/` em uma conexão direta do Neon. O runtime pode usar a URL com pooler. Em um banco que já está em uso, aplique somente [migrations/002_google_identity.sql](./migrations/002_google_identity.sql) para habilitar contas Google.

### Login com Google

No Google Cloud Console, crie uma credencial OAuth 2.0 do tipo **Aplicativo da Web** e adicione as origens JavaScript autorizadas, por exemplo `http://localhost:3000` e o domínio de produção. Defina o Client ID em `NEXT_PUBLIC_GOOGLE_CLIENT_ID`; este fluxo valida o ID token no servidor e não usa client secret nem URI de callback.

Se o e-mail verificado do Google já existir no banco, o app exige a senha atual uma única vez e vincula a identidade à mesma conta. Essa confirmação é necessária porque o cadastro local original não verifica a posse do endereço de e-mail.

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
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Para login Google | Client ID público do Google Identity Services |
| `AI_MODEL_NAME` | Não | Padrão: `openai/gpt-5.6-luna` |
| `AI_GATEWAY_API_KEY` | Apenas local, se necessário | Autenticação do Gateway fora do OIDC da Vercel |

## Deploy na Vercel

Vincule o repositório, configure `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` e `AI_MODEL_NAME`, e execute:

```bash
vercel --prod
```

Depois, confirme `GET /api/health` (banco) e faça um fluxo completo de cadastro e geração. Configure também um limite de gasto no painel do AI Gateway.

## Segurança

- Sessões usam cookies `HttpOnly`, `Secure` em produção e `SameSite=Lax`.
- ID tokens do Google são verificados no servidor quanto a assinatura, emissor, audiência e expiração; a identidade usa o `sub` permanente, não o e-mail.
- Uma conta local existente exige a senha atual no primeiro vínculo com o Google, prevenindo ataques de pré-sequestro de conta.
- Todas as mutações validam sessão, UUID e payload no servidor.
- A saída do modelo é validada por schema antes de ser persistida.
- Se uma credencial já apareceu no histórico Git, remova/rotacione a credencial no provedor; editar apenas o arquivo atual não revoga o segredo.
