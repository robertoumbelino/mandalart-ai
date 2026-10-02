import 'server-only'
import { type DreamPack } from '@/lib/dream-packs'
import { idSchema } from '@/lib/validation'
import { cleanAttribution, type Attribution } from '@/lib/attribution'

// A Kiwify usa um link distinto para cada oferta. O link de afiliado pode
// conter afid; preservar essa query é necessário para a atribuição oficial.
function configuredCheckoutUrl(pack: DreamPack) {
  const configured = process.env[
    pack === 1 ? 'KIWIFY_CHECKOUT_ONE' : 'KIWIFY_CHECKOUT_THREE'
  ]
  if (!configured) throw new Error('Oferta da Kiwify ainda não configurada.')

  let url: URL
  try {
    url = new URL(configured)
  } catch {
    throw new Error('Link de checkout da Kiwify inválido.')
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'pay.kiwify.com.br' ||
    !/^\/[A-Za-z0-9]+\/?$/.test(url.pathname) ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new Error('Link de checkout da Kiwify inválido.')
  }
  return url
}

export function kiwifyCheckoutPreviewLink(pack: DreamPack) {
  return configuredCheckoutUrl(pack).toString()
}

export function kiwifyCheckoutLink(pack: DreamPack, email: string | null, orderId: string, rawAttribution: Attribution = {}) {
  const url = configuredCheckoutUrl(pack)
  if (!idSchema.safeParse(orderId).success)
    throw new Error('Pedido da Kiwify inválido.')

  const attribution = cleanAttribution(rawAttribution)
  for (const [key, value] of Object.entries(attribution)) {
    if (key !== 'sck' && key !== 'afid' && value)
      url.searchParams.set(key, value)
  }
  if (email) url.searchParams.set('email', email)
  url.searchParams.set('sck', orderId)
  return url.toString()
}
