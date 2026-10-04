# Medição da jornada de quatro perguntas

Nova versão: `sales-v3`; versão anterior: `conversion-v2`. O frontend respeita a versão explícita do evento, e compras usam a versão persistida no pedido. Desenvolvimento local e pedidos de teste não são enviados ao PostHog de produção.

O insight novo está salvo no dashboard existente:

- Dashboard: https://us.posthog.com/project/631294/dashboard/2166676
- Funil novo: https://us.posthog.com/project/631294/insights/PS5Ffazr
- Funil anterior: https://us.posthog.com/project/631294/insights/5ONO68ei

O funil novo usa pessoas únicas, sequência ordenada, janela de 14 dias e conversão acumulada desde a entrada. Filtra `site_environment=production` e `journey_version=sales-v3`. A origem `entry_source=kiwify` é exigida somente na entrada; a compra vem do servidor com o mesmo distinct ID do checkout.

| Etapa | Evento | Condição |
| --- | --- | --- |
| Chegada | landing_view | entry_source=kiwify |
| Área | quiz_question | question=1 |
| Objetivo | quiz_question | question=2 |
| Bloqueio | quiz_question | question=3 |
| Quatro respostas | quiz_complete | |
| Fechamento | closing_view | seção visível |
| Clique na oferta | checkout_click | cta_location=sticky ou offer |
| Checkout aberto | checkout_redirect | URL de pagamento obtida |
| Compra | purchase_completed | pagamento confirmado no servidor |

`checkout_view` representa a seleção de pagamento dentro do site, e não garante que o checkout do provedor carregou. `checkout_redirect` mede a saída para o provedor; não temos acesso ao DOM do checkout externo. `pix_qr_shown` mede o QR exibido no Pix direto; o QR dentro da Kiwify não pode ser observado pelo nosso frontend. `card_redirect` e `payment_error` complementam o diagnóstico.

`screen_view` identifica cada pergunta e tela. `quiz_question.duration_ms` mede o tempo até responder. `stack_view`, `example_view` e `offer_view` registram cada seção ao atingir 15% de visibilidade, uma vez por tentativa na montagem. Uma sessão recarregada pode gerar outra visualização; o funil usa pessoas únicas. Esses blocos não são obrigatórios no funil de compra porque o botão fixo permite comprar antes de rolar. `plan_generated` é enviado pelo servidor após salvar o plano.

Compatibilidade: `quiz_complete` também emite `quiz_completed`; `checkout_redirect` também emite `checkout_started`; `payment_error` também emite `checkout_error`. Assim, consultas antigas ainda podem comparar marcos comuns, usando a versão para separar populações. Não são enviados textos do objetivo, e-mail nem respostas aos eventos.

## Corte do histórico ao publicar

A versão nova foi desenvolvida apenas no local. Enquanto a antiga estiver em produção, ainda recebe visitas; o corte correto é o instante da publicação. O filtro `sales-v3` já impede misturar o histórico no insight novo, que começa a contar automaticamente quando houver tráfego real da nova versão.

No momento da publicação:

1. Registrar o instante UTC do corte e a versão publicada.
2. Exportar os números e uma captura do funil antigo **antes de alterar filtros**. Preservar esse arquivo como referência imutável: eventos atrasados, identidades mescladas e conversões dentro da janela podem mudar uma consulta histórica recalculada.
3. Fixar o período antigo de `2026-10-03T16:35:00Z` até o corte. Fixar o início do novo no corte, com fim aberto e filtro `sales-v3`.
4. Conferir os filtros de data do dashboard: eles podem substituir o período do insight. Usar insights separados ao comparar períodos diferentes, ou limpar o filtro global e conferir os períodos de cada card.
5. Comparar taxas com seus denominadores e janelas de exposição. O histórico da campanha inteira e poucas horas da nova versão têm maturidade diferente; anotar o período de cada um. Contagem absoluta sozinha não mede melhoria.

A referência imutável da imagem original está salva em `contents/jornada/posthog-original-baseline.png` e `posthog-original-baseline.json` (arquivos locais, ignorados pelo Git). A imagem original enviada pelo usuário registra 196 entradas, 103 primeiras respostas, 75 formulários completos, 75 prévias prontas e 74 prévias vistas. Ela é um registro daquele instante, não o número final do período antigo. A atualização observada durante o desenvolvimento mostrou 198, 105, 77, 77 e 76 respectivamente, com 5 cliques de desbloqueio, 5 checkouts e nenhuma compra confirmada. O gráfico anterior permanece ativo até o corte de produção, para não excluir o tráfego que ainda está recebendo.

Validação local: quatro respostas → fechamento → checkout Kiwify de teste. Não foram injetados eventos artificiais no projeto PostHog.
