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
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]!)

const link = (url: string, label: string) =>
  `<a href="${escapeHtml(url)}" style="color:#5838db;text-decoration:underline;font-weight:600">${escapeHtml(label)}</a>`

/** Inline styles and table layout keep the message readable in common email clients. */
export function renderEmail(content: EmailContent) {
  const { eyebrow, title, intro, detail, button, buttonUrl, afterButton, secondary, footer, footerLink, unsubscribeUrl } = content
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(title)}</title>
<style>@media only screen and (max-width:620px){.email-pad{padding-left:24px!important;padding-right:24px!important}.email-title{font-size:30px!important;line-height:1.2!important}.email-shell{border-radius:0!important}}</style></head>
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
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px"><tr><td align="center" bgcolor="#633bf0" style="border-radius:10px;background:#633bf0"><a href="${escapeHtml(buttonUrl)}" style="display:inline-block;padding:17px 25px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;line-height:1.3">${escapeHtml(button)} &nbsp;→</a></td></tr></table>
${afterButton ? `<p style="margin:19px 0 0;color:#79758a;font-size:13px;line-height:1.7">${escapeHtml(afterButton)}</p>` : ''}
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
    afterButton: 'Confirme seu e-mail e crie uma senha para abrir seu plano. Este link funciona por 48 horas e pode ser usado uma vez.',
    secondary: { text: 'Já tem uma conta?', label: 'Entre com seu acesso habitual.', url: loginUrl },
    footer: 'Sua compra fica vinculada ao e-mail usado no pagamento. Se o link expirar,',
    footerLink: { label: 'solicite outro aqui.', url: renewUrl },
  })
}

export function registrationEmail(url: string) {
  return renderEmail({
    eyebrow: 'Seu acesso', title: 'Seu plano está esperando por você.',
    intro: 'Sua compra e seu objetivo continuam salvos. Confirme seu e-mail e crie uma senha para acessar seu Mandalart sempre que quiser.',
    button: 'Concluir meu cadastro', buttonUrl: url,
    afterButton: 'O link funciona por 48 horas e pode ser usado uma vez.',
    footer: 'Se você não pediu este e-mail, pode ignorar esta mensagem.',
  })
}

export function previewEmail(subject: string, url: string, message: string, unsubscribeUrl: string) {
  return renderEmail({
    eyebrow: 'Seu primeiro caminho', title: subject, intro: message,
    button: 'Abrir meu primeiro caminho', buttonUrl: url,
    afterButton: 'Sua prévia continua disponível para você retomar com calma. O plano completo é opcional.',
    footer: 'Você recebeu este e-mail porque pediu para salvar sua prévia no Mandalart.', unsubscribeUrl,
  })
}
