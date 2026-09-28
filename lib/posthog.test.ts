import { afterEach, expect, it, vi } from 'vitest'
import posthog from 'posthog-js'

vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    stopSessionRecording: vi.fn(),
    startSessionRecording: vi.fn(),
    opt_out_capturing: vi.fn(),
    opt_in_capturing: vi.fn(),
  },
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
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
    screen: 'onboarding_start', site_environment: 'production',
  })

  stopPostHog()
  expect(values.get(POSTHOG_OPTOUT_KEY)).toBe('true')
  expect(captureProductEvent('screen_view')).toBe(false)
  expect(posthog.capture).toHaveBeenCalledTimes(1)

  resumePostHog()
  expect(captureProductEvent('screen_view')).toBe(true)
  expect(posthog.capture).toHaveBeenCalledTimes(2)
})
