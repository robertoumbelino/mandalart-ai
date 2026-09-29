import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DRAFT_STORAGE_KEY } from './onboarding'
import { clearOnboardingDraft, markOnboardingPurchased, purchasedPreview } from './onboarding-storage'

function storage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) }
}
beforeEach(() => {
  vi.stubGlobal('localStorage', storage())
  vi.stubGlobal('sessionStorage', storage())
})
afterEach(() => vi.unstubAllGlobals())

it('clears the paid preview and lead while retaining a marker against stale tabs', () => {
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ result: { id: 'paid-preview' } }))
  sessionStorage.setItem('mandalart.lead_id', 'lead')
  markOnboardingPurchased('paid-preview')
  expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull()
  expect(sessionStorage.getItem('mandalart.lead_id')).toBeNull()
  expect(purchasedPreview('paid-preview')).toBe(true)
})

it('does not erase a newer dream when an older checkout finishes', () => {
  const newer = JSON.stringify({ result: { id: 'newer-preview' } })
  localStorage.setItem(DRAFT_STORAGE_KEY, newer)
  markOnboardingPurchased('older-preview')
  expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBe(newer)
  expect(purchasedPreview('newer-preview')).toBe(false)
})

it('restarting clears only the quiz data, retaining consent and authentication data', () => {
  localStorage.setItem('consent', 'accepted')
  localStorage.setItem(DRAFT_STORAGE_KEY, 'draft')
  clearOnboardingDraft()
  expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull()
  expect(localStorage.getItem('consent')).toBe('accepted')
})

it('tolerates unavailable browser storage', () => {
  vi.stubGlobal('localStorage', { getItem() { throw new Error('Disabled') }, removeItem() { throw new Error('Disabled') } })
  expect(() => markOnboardingPurchased('preview')).not.toThrow()
  expect(() => clearOnboardingDraft()).not.toThrow()
  expect(purchasedPreview('preview')).toBe(false)
})
