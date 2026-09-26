# Mandalart.AI

Aplicação que transforma um objetivo em uma matriz Mandalart 9×9: 8 subobjetivos, cada um com 8 tarefas e checklists acionáveis.

## Stack

- Next.js 16 e React 19
- Vercel AI SDK 7 com Vercel AI Gateway
- `openai/gpt-5.6-luna` como modelo padrão de bom custo-benefício
- Neon Postgres com `@neondatabase/serverless`
- Tailwind CSS 4
- Managed Better Auth do Neon para login Google e senha; Zod e JWT para a prévia anônima

O OpenRouter foi removido. As chamadas de IA são Server Actions, portanto credenciais e prompts não entram no bundle do navegador. Em deploys na Vercel, o Gateway usa o token OIDC do próprio projeto; uma `AI_GATEWAY_API_KEY` só é necessária quando o desenvolvimento local não usa `vercel dev`.

## Desenvolvimento local

Requisitos: Node.js 22.18 ou superior e pnpm 10.

```bash
pnpm install
cp .env.example .env.local
docker start adstart-database
for migration in migrations/*.sql; do
  docker exec -i adstart-database psql -v ON_ERROR_STOP=1 -U mandalart -d mandalart_local < "$migration"
done
pnpm dev
```

O Postgres local reutiliza o container `adstart-database` na porta `127.0.0.1:5432`, com banco próprio `mandalart_local` e usuário `mandalart` (senha local: `mandalart_local_dev`). A base do Mandalart é separada das bases da Adstart. Não é necessário iniciar outro Postgres. Em uma máquina nova, crie esse usuário e banco no Postgres local antes de aplicar as migrations. Em uma base existente, aplique somente as migrations pendentes.

Preencha `.env.local` com `JWT_SECRET`, `NEON_AUTH_COOKIE_SECRET` (ambos aleatórios, com pelo menos 32 caracteres), `NEON_AUTH_BASE_URL` da branch de desenvolvimento e a chave do AI Gateway. O ambiente de desenvolvimento recusa conexões remotas; `LOCAL_DATABASE_ONLY=true` mantém essa proteção também ao testar um build de produção localmente. A configuração do deploy continua usando Neon.

Ao importar variáveis da Vercel, preserve o `DATABASE_URL` local. Nunca execute migrations de desenvolvimento contra a conexão de produção.

Antes da primeira execução, aplique, em ordem, as migrations de `migrations/` em uma conexão direta do banco. O runtime pode usar a URL com pooler. Em uma base já existente, aplique somente as migrations pendentes; a [migration de vínculo com Neon Auth](./migrations/005_neon_auth_links.sql) preserva os IDs usados por planos, créditos e compras.

As instruções de Neon acima se aplicam somente ao deploy. A jornada pública também requer [migrations/003_onboarding.sql](./migrations/003_onboarding.sql), a ser aplicada no ambiente de destino antes de publicar. Nenhuma migration de produção é executada automaticamente.

## Jornada pública

Abra `http://localhost:3000/comecar`. Toda a experiência permanece nessa URL: apresentação, seis perguntas, geração, prévia e oferta. Login não é necessário para a prévia. A compra acontece em `/sonhos`, com login e checkout Stripe. Veja [docs/onboarding.md](./docs/onboarding.md) para regras de persistência, limites e pontos de integração.

### Autenticação

O login e as sessões usam o Managed Better Auth da mesma branch Neon do banco. Configure `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` e os domínios confiáveis no Neon. A migração começa com o cliente Google compartilhado do Neon, que mostra a marca Neon na tela de consentimento e é destinado a desenvolvimento. Para uso público contínuo, configure um cliente OAuth próprio no Neon e registre no Google Cloud a URI de retorno `{NEON_AUTH_BASE_URL}/callback/google`.

No primeiro login Google depois da migração, o `accountId` (Google `sub`) é comparado com `user_identities`; o vínculo preserva `users.id` e todos os dados de produto. Uma senha antiga pode ser migrada quando o usuário a digitar, antes de criar a credencial Neon. Se a conta já tiver entrado pelo Google no Neon, o usuário define uma senha pelo link recebido por e-mail. Novos cadastros e sessões usam exclusivamente Neon Auth.

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
| `JWT_SECRET` | Sim | Assinatura da sessão anônima da prévia; mínimo de 32 caracteres |
| `NEON_AUTH_BASE_URL` | Sim | URL de Auth da mesma branch Neon do banco |
| `NEON_AUTH_COOKIE_SECRET` | Sim | Assinatura dos cookies de autenticação; mínimo de 32 caracteres |
| `AI_MODEL_NAME` | Não | Padrão: `openai/gpt-5.6-luna` |
| `AI_GATEWAY_API_KEY` | Apenas local, se necessário | Autenticação do Gateway fora do OIDC da Vercel |

## Deploy na Vercel

Vincule o repositório, configure `DATABASE_URL`, `JWT_SECRET`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` e `AI_MODEL_NAME`, e execute:

```bash
vercel --prod
```

Depois, confirme `GET /api/health` (banco) e faça um fluxo completo de cadastro e geração. Configure também um limite de gasto no painel do AI Gateway.

## Segurança

- Sessões autenticadas e cookies são gerenciados pelo SDK Neon Auth.
- O vínculo de uma conta Google antiga usa o identificador estável do Google, não somente o e-mail.
- A migração de uma senha antiga exige a senha atual; um e-mail sem verificação não assume uma conta existente.
- Todas as mutações validam sessão, UUID e payload no servidor.
- A saída do modelo é validada por schema antes de ser persistida.
- Se uma credencial já apareceu no histórico Git, remova/rotacione a credencial no provedor; editar apenas o arquivo atual não revoga o segredo.

## Compra e créditos de sonhos

Veja [docs/payments.md](./docs/payments.md) para configurar os pacotes de R$ 37,00 e R$ 99,90, simular compras e entender saldo, devoluções e a disponibilidade do Pix. A cobrança requer a migration 004 no banco do ambiente.
