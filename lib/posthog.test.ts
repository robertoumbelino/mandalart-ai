import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import posthog from 'posthog-js'

vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    stopSessionRecording: vi.fn(),
    startSessionRecording: vi.fn(),
    opt_out_capturing: vi.fn(),
    opt_in_capturing: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    get_distinct_id: vi.fn(() => 'visitor-1'),
  },
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'test-token')
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://us.i.posthog.com')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it.each([
  ['production', 'http://localhost:3100'],
  ['production', 'http://127.0.0.1:3100'],
  ['production', 'http://[::1]:3100'],
  ['production', 'http://192.168.1.10:3100'],
  ['production', 'https://mandalart-ai-preview.vercel.app'],
  ['production', 'https://mandalart.com.br.example.com'],
  ['production', 'https://mandalart.com.br:3100'],
  ['development', 'https://mandalart.com.br'],
  ['test', 'https://mandalart.com.br'],
])('never starts analytics or recording in %s on %s', async (environment, origin) => {
  vi.stubEnv('NODE_ENV', environment)
  vi.stubGlobal('window', { location: new URL(origin) })
  const analytics = await import('./posthog')
  expect(analytics.captureProductEvent('$pageview')).toBe(false)
  expect(analytics.getProductDistinctId()).toBeUndefined()
  analytics.identifyProductUser('user-1')
  analytics.resumePostHog()
  analytics.resetProductUser()
  for (const method of Object.values(posthog)) expect(method).not.toHaveBeenCalled()
})

it.each(['mandalart.com.br', 'www.mandalart.com.br', 'mandalart-ai.vercel.app'])('starts analytics on production host %s', async hostname => {
  vi.stubGlobal('window', { location: new URL(`https://${hostname}`) })
  const analytics = await import('./posthog')
  expect(analytics.captureProductEvent('$pageview')).toBe(true)
  expect(analytics.getProductDistinctId()).toBe('visitor-1')
  expect(posthog.init).toHaveBeenCalledTimes(1)
})

it('captures without an advertising choice and respects the analytics opt-out', async () => {
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'test-token')
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://us.i.posthog.com')
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  })
  vi.stubGlobal('window', { location: { hostname: 'mandalart.com.br', origin: 'https://mandalart.com.br' } })

  const { captureProductEvent, stopPostHog, resumePostHog, POSTHOG_OPTOUT_KEY } = await import('./posthog')

  expect(captureProductEvent('screen_view', { screen: 'onboarding_start' })).toBe(true)
  expect(posthog.init).toHaveBeenCalledWith('test-token', expect.objectContaining({
    session_recording: expect.objectContaining({
      maskAllInputs: false,
      maskInputOptions: { email: true, password: true },
      maskTextSelector: '.ph-mask',
    }),
  }))
  expect(posthog.capture).toHaveBeenCalledWith('screen_view', {
    screen: 'onboarding_start', site_environment: 'production', journey_version: 'conversion-v2',
  })

  stopPostHog()
  expect(values.get(POSTHOG_OPTOUT_KEY)).toBe('true')
  expect(captureProductEvent('screen_view')).toBe(false)
  expect(posthog.capture).toHaveBeenCalledTimes(1)

  resumePostHog()
  expect(captureProductEvent('screen_view')).toBe(true)
  expect(posthog.capture).toHaveBeenCalledTimes(2)
})
