export const SUPPORT_EMAIL = 'ola@mail.mandalart.com.br'

export function getSupportHref(subject = 'Ajuda com o Mandalart') {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
}
