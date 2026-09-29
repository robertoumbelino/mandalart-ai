// Next can normalize request.url behind a proxy; Host is the public request host.
export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  try {
    const source = new URL(origin || '')
    return source.origin === origin && source.host === request.headers.get('host')
      && ['http:', 'https:'].includes(source.protocol)
  } catch { return false }
}
