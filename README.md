# Mandalart

Aplicação que transforma um objetivo em uma matriz Mandalart 9×9: 8 subobjetivos, cada um com 8 tarefas e checklists acionáveis.

## Stack

- Next.js 16 e React 19
- Vercel AI SDK 7 com Vercel AI Gateway
- `openai/gpt-6-luna` para prévia e plano; `openai/gpt-6-luna-fast` para descoberta do objetivo e classificação de segurança
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
Antes de publicar a medição do funil e a atribuição de campanhas, aplique também [migrations/006_order_attribution.sql](./migrations/006_order_attribution.sql) no banco do ambiente de destino. O checkout grava UTMs no pedido e depende dessa coluna.
O checkout público sem senha, a retomada por e-mail e os eventos próprios da jornada exigem [migrations/007_conversion_journey.sql](./migrations/007_conversion_journey.sql), aplicada antes do deploy. Configure o Resend com domínio verificado e `STRIPE_PRICE_BUMP` no mesmo ambiente; veja [docs/onboarding.md](./docs/onboarding.md).

## Jornada pública

Abra `http://localhost:3000/comecar`. Toda a experiência permanece nessa URL: apresentação, seis perguntas, geração, prévia e oferta. Login não é necessário para a prévia. A compra acontece em `/sonhos`, com login e checkout Stripe. Veja [docs/onboarding.md](./docs/onboarding.md) para regras de persistência, limites e pontos de integração.
Compras Stripe confirmadas podem ser reembolsadas pela própria pessoa em `/reembolso` por até 7 dias após a confirmação; a conciliação do saldo usa o mesmo fluxo seguro dos demais estornos. Veja [docs/payments.md](./docs/payments.md).

Na página principal, quem já tem um sonho disponível escreve o objetivo e recebe uma pergunta de cada vez, com opções geradas conforme as respostas. Objetivos curtos e amplos exigem mais contexto antes da confirmação; um objetivo amplo de negócio exige pelo menos três respostas. Depois disso, a IA encerra quando há base para um objetivo e uma primeira fase úteis; seis respostas são o limite técnico para evitar uma entrevista sem fim. A pessoa pode escolher "Ainda não sei" ou escrever em "Outro", revisar a proposta e só então gerar o planner, consumindo um sonho. A entrevista e a proposta ficam em `sessionStorage` para retomada no mesmo navegador. Quem chega pela prévia de `/comecar` confirma o sonho e o primeiro passo já apresentados antes da geração.

### Autenticação

O login e as sessões usam o Managed Better Auth da mesma branch Neon do banco. Configure `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` e os domínios confiáveis no Neon. A migração começa com o cliente Google compartilhado do Neon, que mostra a marca Neon na tela de consentimento e é destinado a desenvolvimento. Para uso público contínuo, configure um cliente OAuth próprio no Neon e registre no Google Cloud a URI de retorno `{NEON_AUTH_BASE_URL}/callback/google`.

No primeiro login Google depois da migração, o `accountId` (Google `sub`) é comparado com `user_identities`; o vínculo preserva `users.id` e todos os dados de produto. Uma senha antiga pode ser migrada quando o usuário a digitar, antes de criar a credencial Neon. Se a conta já tiver entrado pelo Google no Neon, o usuário define uma senha pelo link recebido por e-mail. Novos cadastros e sessões usam exclusivamente Neon Auth.

## Qualidade

```bash
pnpm check
pnpm build
```

`check` executa ESLint, TypeScript e testes Vitest.

## Conteúdo local

Use `contents/` para criar vídeos, imagens, áudios, roteiros e outros materiais de conteúdo. Crie a pasta quando necessário em um checkout novo. Ela está no `.gitignore`, incluindo arquivos de trabalho, dependências locais e exports. Ferramentas usadas apenas para gerar conteúdo ficam no `contents/package.json`, sem alterar as dependências da aplicação.

## Variáveis de ambiente

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `DATABASE_URL` | Sim | Conexão do Neon |
| `JWT_SECRET` | Sim | Assinatura da sessão anônima da prévia; mínimo de 32 caracteres |
| `NEON_AUTH_BASE_URL` | Sim | URL de Auth da mesma branch Neon do banco |
| `NEON_AUTH_COOKIE_SECRET` | Sim | Assinatura dos cookies de autenticação; mínimo de 32 caracteres |
| `AI_PLAN_MODEL_NAME` | Não | Padrão: `openai/gpt-6-luna` para prévia e plano |
| `AI_QUESTION_MODEL_NAME` | Não | Padrão: `openai/gpt-6-luna-fast` para perguntas e segurança |
| `AI_GATEWAY_API_KEY` | Apenas local, se necessário | Autenticação do Gateway fora do OIDC da Vercel |

## Deploy na Vercel

Vincule o repositório, configure `DATABASE_URL`, `JWT_SECRET`, `NEON_AUTH_BASE_URL` e `NEON_AUTH_COOKIE_SECRET`; os modelos podem ser substituídos pelas variáveis opcionais acima. Execute:

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
