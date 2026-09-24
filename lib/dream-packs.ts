export const DREAM_PACKS = {
  1: { credits: 1, amount: 3990, label: '1 sonho', price: 'R$ 39,90' },
  3: { credits: 3, amount: 9990, label: '3 sonhos', price: 'R$ 99,90' },
} as const
export type DreamPack = keyof typeof DREAM_PACKS
export const formatBRL = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    cents / 100,
  )
