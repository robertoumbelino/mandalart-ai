import { expect, it } from 'vitest'
import { purchaseEmail, previewEmail } from './email-template'

const preview = {
  title: 'Criar uma rotina de movimento',
  introduction: 'Um caminho para começar aos poucos e avançar no seu ritmo.',
  pillars: Array.from({ length: 8 }, (_, i) => ({ title: `Caminho ${i + 1}`, description: 'Uma parte importante do seu plano.' })),
  firstStep: {
    title: 'Escolher o primeiro movimento', description: 'Escolha uma atividade e dois horários para começar.', minutes: 15,
    checklist: ['Anote três movimentos para experimentar.', 'Escolha um movimento para começar.', 'Reserve dois horários na agenda.'],
  },
}

it('escapes order content and URLs without losing the access links', () => {
  const html = purchaseEmail('R$ 37,00 <script>', 1, 'https://example.com/register?token=a&b=c', 'https://example.com/login', 'https://example.com/renew')

  expect(html).toContain('R$ 37,00 &lt;script&gt;')
  expect(html).not.toContain('<script>')
  expect(html).toContain('href="https://example.com/register?token=a&amp;b=c"')
  expect(html).toContain('href="https://example.com/login"')
  expect(html).toContain('href="https://example.com/renew"')
})

it('keeps the unsubscribe link in the preview email', () => {
  const html = previewEmail('Seu caminho', 'https://example.com/preview', 'Seu primeiro passo.', 'https://example.com/unsubscribe')

  expect(html).toContain('href="https://example.com/unsubscribe"')
  expect(html).toContain('O plano completo é opcional.')
})

it('includes the saved goal, all eight paths, the free task and paid benefits', () => {
  const html = previewEmail('Seu primeiro passo', 'https://example.com/resume?token=a&b=c', 'Sua prévia está salva.', 'https://example.com/unsubscribe', { dream: 'Criar uma rotina de movimento', preview })

  expect(html).toContain('Criar uma rotina de movimento')
  for (const pillar of preview.pillars) expect(html).toContain(pillar.title)
  expect(html).toContain(preview.firstStep.title)
  expect(html).toContain(preview.firstStep.description)
  for (const action of preview.firstStep.checklist) expect(html).toContain(action)
  expect(html).toContain('Cerca de 15 minutos')
  expect(html).toContain('SEU PRIMEIRO PASSO · GRÁTIS')
  expect(html).toContain('As demais tarefas são liberadas no plano completo.')
  expect(html).toContain('64 tarefas')
  expect(html).toContain('192 pequenas ações')
  expect(html).toContain('Checklists e progresso salvo')
  expect(html).toContain('href="https://example.com/resume?token=a&amp;b=c"')
  expect(html).toContain('href="https://example.com/unsubscribe"')
  expect(Buffer.byteLength(html)).toBeLessThan(80_000)
  expect(html).not.toMatch(/<script|<input|<img/)
})

it('escapes personal and generated content throughout the rich preview', () => {
  const unsafe = '<img src=x onerror="alert(1)"> & "teste"'
  const html = previewEmail('Seu passo', 'https://example.com/resume', 'Sua prévia.', 'https://example.com/unsubscribe', {
    dream: unsafe,
    preview: { ...preview, pillars: preview.pillars.map(pillar => ({ ...pillar, title: unsafe })), firstStep: { ...preview.firstStep, title: unsafe, description: unsafe, checklist: [unsafe, unsafe, unsafe] } },
  })

  expect(html).not.toContain(unsafe)
  expect(html).not.toContain('<img')
  expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &quot;teste&quot;')
})
