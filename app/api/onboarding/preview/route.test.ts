import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { preparePreview } from '@/lib/onboarding-server'

vi.mock('@/lib/onboarding-server', () => ({ preparePreview: vi.fn() }))
const answers = {
  category: 'learning',
  dream: 'Aprender um idioma',
  stage: 'idea',
  obstacle: 'direction',
  time: 'one',
  horizon: 'quarter'
}
function request(body: string, origin = 'http://127.0.0.1:3000') {
  return new Request('http://localhost:3000/api/onboarding/preview', {
    method: 'POST',
    headers: {
      origin,
      host: '127.0.0.1:3000',
      'content-type': 'application/json'
    },
    body
  })
}
describe('public preview route', () => {
  beforeEach(() => {
    vi.mocked(preparePreview).mockReset()
  })
  it('accepts same-origin requests even when Next uses an internal host', async () => {
    vi.mocked(preparePreview).mockResolvedValue({
      status: 'blocked',
      category: 'illegal'
    })
    const response = await POST(
      request(
        JSON.stringify({
          answers,
          attribution: { ref: 'affiliate', arbitrary: 'ignored' }
        })
      )
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(preparePreview).toHaveBeenCalledWith(
      { ...answers, customDream: '' },
      { ref: 'affiliate' }
    )
  })
  it('rejects cross-origin requests before invoking any generation', async () => {
    expect(
      (
        await POST(
          request(JSON.stringify({ answers }), 'https://another-site.example')
        )
      ).status
    ).toBe(403)
    expect(preparePreview).not.toHaveBeenCalled()
  })
  it('rejects invalid choices before spending on AI', async () => {
    expect(
      (
        await POST(
          request(
            JSON.stringify({ answers: { ...answers, dream: 'invented' } })
          )
        )
      ).status
    ).toBe(400)
    expect(preparePreview).not.toHaveBeenCalled()
  })
  it('rejects oversized requests without generation', async () => {
    expect((await POST(request('a'.repeat(10001)))).status).toBe(413)
    expect(preparePreview).not.toHaveBeenCalled()
  })
  it('returns a recoverable error without leaking infrastructure details', async () => {
    vi.mocked(preparePreview).mockRejectedValue(
      new Error('SECRET database password')
    )
    const response = await POST(request(JSON.stringify({ answers })))
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('SECRET')
  })
})
