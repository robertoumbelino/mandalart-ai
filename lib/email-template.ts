import type { OnboardingPreview } from './onboarding'

type EmailContent = {
  eyebrow: string
  title: string
  intro: string
  detail?: { label: string; value: string; note: string }
  button: string
  buttonUrl: string
  afterButton?: string
  secondary?: { text: string; label: string; url: string }
  footer: string
  footerLink?: { label: string; url: string }
  unsubscribeUrl?: string
  beforeButtonHtml?: string
  afterButtonHtml?: string
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]!)

const link = (url: string, label: string) =>
  `<a href="${escapeHtml(url)}" style="color:#5838db;text-decoration:underline;font-weight:600">${escapeHtml(label)}</a>`

/** Inline styles and table layout keep the message readable in common email clients. */
export function renderEmail(content: EmailContent) {
  const { eyebrow, title, intro, detail, button, buttonUrl, afterButton, secondary, footer, footerLink, unsubscribeUrl, beforeButtonHtml, afterButtonHtml } = content
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(title)}</title>
<style>@media only screen and (max-width:620px){.email-pad{padding-left:24px!important;padding-right:24px!important}.email-title{font-size:30px!important;line-height:1.2!important}.email-shell{border-radius:0!important}.mandala-cell{padding:10px 6px!important;height:108px!important}.mandala-title{font-size:11px!important}.mandala-goal{font-size:14px!important}}</style></head>
<body style="margin:0;padding:0;background:#f5f4fa;color:#20213b;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;font-size:1px;color:#f5f4fa;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${escapeHtml(intro)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;table-layout:fixed;background:#f5f4fa"><tr><td align="center" style="padding:32px 12px 40px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="email-shell" style="width:100%;max-width:600px;table-layout:fixed;background:#ffffff;border:1px solid #e9e6f1;border-radius:20px;overflow:hidden">
<tr><td class="email-pad" style="padding:30px 42px 26px;border-bottom:1px solid #efedf5">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right:11px" valign="middle"><table role="presentation" cellpadding="0" cellspacing="3" border="0" style="background:#ffffff"><tr><td width="11" height="11" style="background:#5940ed;border-radius:3px"></td><td width="11" height="11" style="background:#8040f0;border-radius:3px"></td></tr><tr><td width="11" height="11" style="background:#6841ed;border-radius:3px"></td><td width="11" height="11" style="background:#a137f0;border-radius:3px"></td></tr></table></td><td valign="middle" style="font-size:24px;font-weight:800;letter-spacing:-1.3px;color:#22213a">Mandal<span style="color:#633bf0">art</span></td></tr></table>
</td></tr>
<tr><td class="email-pad" style="padding:38px 42px 34px;background:#f3efff">
<p style="margin:0 0 13px;color:#5d3ee1;font-size:11px;font-weight:800;letter-spacing:2px;line-height:1.5;text-transform:uppercase">${escapeHtml(eyebrow)}</p>
<h1 class="email-title" style="margin:0;max-width:460px;color:#25213e;font-size:38px;line-height:1.15;letter-spacing:-1.5px;font-weight:800">${escapeHtml(title)}</h1>
<div style="width:46px;height:4px;margin-top:24px;background:#633bf0;border-radius:4px"></div>
</td></tr>
<tr><td class="email-pad" style="padding:36px 42px 18px">
<p style="margin:0;color:#4a4860;font-size:16px;line-height:1.75">${escapeHtml(intro)}</p>
${detail ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:28px;background:#f8f7fc;border:1px solid #eeeaf7;border-radius:12px"><tr><td style="padding:19px 22px"><p style="margin:0 0 6px;color:#77738b;font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase">${escapeHtml(detail.label)}</p><p style="margin:0 0 4px;color:#25213e;font-size:19px;font-weight:800;line-height:1.4">${escapeHtml(detail.value)}</p><p style="margin:0;color:#77738b;font-size:13px;line-height:1.5">${escapeHtml(detail.note)}</p></td></tr></table>` : ''}
${beforeButtonHtml || ''}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px"><tr><td align="center" bgcolor="#633bf0" style="border-radius:10px;background:#633bf0"><a href="${escapeHtml(buttonUrl)}" style="display:inline-block;padding:17px 25px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;line-height:1.3">${escapeHtml(button)} &nbsp;→</a></td></tr></table>
${afterButton ? `<p style="margin:19px 0 0;color:#79758a;font-size:13px;line-height:1.7">${escapeHtml(afterButton)}</p>` : ''}
${afterButtonHtml || ''}
${secondary ? `<p style="margin:24px 0 0;padding-top:22px;border-top:1px solid #eeecf4;color:#5b586d;font-size:14px;line-height:1.7">${escapeHtml(secondary.text)} ${link(secondary.url, secondary.label)}</p>` : ''}
</td></tr>
<tr><td class="email-pad" style="padding:20px 42px 32px"><p style="margin:0;color:#8a8699;font-size:12px;line-height:1.7">${escapeHtml(footer)}${footerLink ? ` ${link(footerLink.url, footerLink.label)}` : ''}</p></td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px"><tr><td align="center" style="padding:22px 24px;color:#8d899c;font-size:12px;line-height:1.7">Mandalart · Um sonho de cada vez.<br>${unsubscribeUrl ? link(unsubscribeUrl, 'Não quero receber mais lembretes') : 'Esta mensagem foi enviada para ajudar você a acessar seu Mandalart.'}</td></tr></table>
</td></tr></table></body></html>`
}

export function purchaseEmail(price: string, credits: number, url: string, loginUrl: string, renewUrl: string) {
  return renderEmail({
    eyebrow: 'Compra confirmada', title: 'Seu sonho ganhou um caminho.',
    intro: 'Recebemos seu pagamento. Seu objetivo está salvo e seu Mandalart está pronto para você continuar de onde parou.',
    detail: { label: 'Resumo da compra', value: `${credits} Mandalart${credits === 1 ? '' : 's'} · ${price}`, note: 'Pagamento único, sem assinatura.' },
    button: 'Concluir meu cadastro', buttonUrl: url,
    afterButton: 'Abra o link para escolher como acessar seu plano. Ele funciona por 48 horas e pode ser usado uma vez.',
    secondary: { text: 'Já tem uma conta?', label: 'Entre com seu acesso habitual.', url: loginUrl },
    footer: 'Sua compra fica vinculada ao e-mail usado no pagamento. Se o link expirar,',
    footerLink: { label: 'solicite outro aqui.', url: renewUrl },
  })
}

export function registrationEmail(url: string) {
  return renderEmail({
    eyebrow: 'Seu acesso', title: 'Seu plano está esperando por você.',
    intro: 'Sua compra e seu objetivo continuam salvos. Abra o link para escolher como acessar seu Mandalart sempre que quiser.',
    button: 'Concluir meu cadastro', buttonUrl: url,
    afterButton: 'O link funciona por 48 horas e pode ser usado uma vez.',
    footer: 'Se você não pediu este e-mail, pode ignorar esta mensagem.',
  })
}

export type PreviewEmailData = { dream: string; preview: OnboardingPreview }

function previewSections({ dream, preview }: PreviewEmailData, url: string) {
  const cell = (index: number | null) => {
    const isGoal = index === null
    const label = isGoal ? 'OBJETIVO' : String(index + 1).padStart(2, '0')
    const title = isGoal ? dream : preview.pillars[index].title
    return `<td width="33%" valign="middle" class="mandala-cell" style="width:33.33%;height:126px;padding:12px 9px;background:${isGoal ? '#633bf0' : '#f8f6ff'};border:1px solid ${index === 0 ? '#633bf0' : '#e5dff5'};border-radius:10px;overflow-wrap:anywhere;word-wrap:break-word"><p style="margin:0 0 10px;font-size:9px;font-weight:700;letter-spacing:1px;color:${isGoal ? '#e7deff' : '#8173b5'}">${label}</p><p class="${isGoal ? 'mandala-goal' : 'mandala-title'}" style="margin:0;font-size:${isGoal ? '18' : '13'}px;font-weight:700;line-height:1.35;color:${isGoal ? '#ffffff' : '#41395c'}">${escapeHtml(title)}</p></td>`
  }
  const mandala = [[0, 1, 2], [3, null, 4], [5, 6, 7]]
    .map(row => `<tr>${row.map(cell).join('')}</tr>`).join('')
  const actions = preview.firstStep.checklist.map((action, index) =>
    `<tr><td width="28" valign="top" style="padding:12px 0;border-top:1px solid #ece7f6;color:#633bf0;font-size:14px;font-weight:700">${index + 1}.</td><td valign="top" style="padding:12px 0;border-top:1px solid #ece7f6;color:#4a4860;font-size:14px;line-height:1.6;overflow-wrap:anywhere">${escapeHtml(action)}</td></tr>`).join('')
  const benefits = [
    ['Seu plano personalizado', '8 caminhos e 64 tarefas para o seu objetivo.'],
    ['Jornada guiada', 'Uma tarefa por vez, na ordem recomendada.'],
    ['Passo a passo para agir', '192 pequenas ações com instruções práticas.'],
    ['Checklists e progresso salvo', 'Marque o que fez e retome de onde parou.'],
    ['Dicas em cada tarefa', 'Orientação prática para ajudar você a avançar.'],
    ['No celular e no computador', 'Acesse pelo navegador, sem instalar nada.'],
  ].map(([title, description]) => `<tr><td style="padding:15px 0;border-bottom:1px solid #ece7f6"><p style="margin:0 0 4px;font-size:15px;font-weight:700;line-height:1.4;color:#25213e">${title}</p><p style="margin:0;font-size:14px;line-height:1.6;color:#625b77">${description}</p></td></tr>`).join('')
  return {
    beforeButtonHtml: `<h2 style="margin:30px 0 8px;color:#25213e;font-size:23px;line-height:1.3;letter-spacing:-.5px">Seu sonho, em 8 caminhos</h2>
<p style="margin:0 0 16px;color:#625b77;font-size:14px;line-height:1.6">Seu objetivo no centro. Ao redor, os caminhos para colocar em prática.</p>
<table role="presentation" aria-label="Os oito caminhos do seu Mandalart" cellpadding="0" cellspacing="6" border="0" width="100%" style="width:100%;table-layout:fixed;text-align:center">${mandala}</table>
<p style="margin:10px 0 28px;color:#79758a;font-size:12px;line-height:1.6">O primeiro passo está abaixo, grátis. As demais tarefas são liberadas no plano completo.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#faf9ff;border:1px solid #e5dff5;border-radius:14px"><tr><td style="padding:24px">
<p style="margin:0 0 10px;color:#633bf0;font-size:11px;font-weight:700;letter-spacing:1px">SEU PRIMEIRO PASSO · GRÁTIS</p>
<h2 style="margin:0 0 12px;color:#25213e;font-size:21px;line-height:1.35;overflow-wrap:anywhere">${escapeHtml(preview.firstStep.title)}</h2>
<p style="margin:0 0 14px;color:#4a4860;font-size:14px;line-height:1.7;overflow-wrap:anywhere">${escapeHtml(preview.firstStep.description)}</p>
<p style="margin:0 0 16px;color:#79758a;font-size:12px;line-height:1.5">Cerca de ${preview.firstStep.minutes} minutos · 3 pequenas ações</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${actions}</table>
<p style="margin:12px 0 0;color:#79758a;font-size:12px;line-height:1.6">Abra sua prévia para marcar o que concluiu e salvar seu progresso.</p>
</td></tr></table>`,
    afterButtonHtml: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:32px;border-top:1px solid #ece7f6"><tr><td style="padding-top:28px">
<p style="margin:0 0 9px;color:#633bf0;font-size:11px;font-weight:700;letter-spacing:1px">NO PLANO COMPLETO</p>
<h2 style="margin:0 0 8px;color:#25213e;font-size:23px;line-height:1.3">Tudo o que você recebe</h2>
<p style="margin:0 0 6px;color:#625b77;font-size:14px;line-height:1.6">Se quiser continuar além do primeiro passo, você pode comprar o plano completo:</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${benefits}</table>
<p style="margin:20px 0 0;color:#625b77;font-size:14px;line-height:1.6">Para saber o que fazer hoje e avançar no seu ritmo, uma tarefa por vez.</p>
<p style="margin:18px 0 0;font-size:14px;line-height:1.6">${link(url, 'Conhecer meu plano completo →')}</p>
</td></tr></table>`,
  }
}

export function previewEmail(subject: string, url: string, message: string, unsubscribeUrl: string, data?: PreviewEmailData) {
  return renderEmail({
    eyebrow: data ? 'Sua prévia, para guardar' : 'Seu primeiro caminho', title: subject, intro: message,
    ...(data ? previewSections(data, url) : {}),
    button: data ? 'Continuar meu primeiro passo' : 'Abrir meu primeiro caminho', buttonUrl: url,
    afterButton: 'Este link permite retomar sua prévia por 7 dias. O plano completo é opcional.',
    footer: 'Você recebeu este e-mail porque pediu para salvar sua prévia no Mandalart.', unsubscribeUrl,
  })
}
