// Volátil — OAuth para Decap CMS. Modificação de 15/11/2026, GPL-3.0-only.
const cookieName = '__Host-volatil_oauth'
const cookieOptions = 'Path=/; Secure; HttpOnly; SameSite=Lax'
const clearCookie = `${cookieName}=; ${cookieOptions}; Max-Age=0`
const githubHeaders = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'volatil-decap-oauth',
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function random() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)))
}

function response(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  })
}

function popup(origin, success, value) {
  const nonce = random()
  const message = `authorization:github:${success ? 'success' : 'error'}:${JSON.stringify(value)}`
  const literal = JSON.stringify(message).replaceAll('<', '\\u003c')
  return response(
    `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Volátil — autenticação</title><p>Concluindo a autenticação. Mantenha esta janela aberta.</p><script nonce="${nonce}">
const origin = ${JSON.stringify(origin)};
if (window.opener) {
  window.addEventListener('message', (event) => {
    if (event.origin !== origin || event.source !== window.opener || event.data !== 'authorizing:github') return;
    window.opener.postMessage(${literal}, origin);
  });
  window.opener.postMessage('authorizing:github', origin);
}
</script></html>`,
    200,
    {
      'Content-Type': 'text/html; charset=utf-8',
      'Set-Cookie': clearCookie,
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
    },
  )
}

export async function handle(request, env, fetcher = fetch) {
  const url = new URL(request.url)
  if (request.method !== 'GET')
    return response('Método não permitido.', 405, { Allow: 'GET' })
  const configured = Boolean(
    env.GITHUB_CLIENT_ID &&
      env.GITHUB_CLIENT_SECRET &&
      env.ALLOWED_ORIGIN &&
      env.REPOSITORY,
  )
  if (url.pathname === '/health')
    return response(JSON.stringify({ configured }), configured ? 200 : 503, {
      'Content-Type': 'application/json',
    })
  if (!configured) return response('OAuth ainda não configurado.', 503)
  // Nunca derive o destinatário do token de parâmetros enviados pelo navegador.
  const origin = new URL(env.ALLOWED_ORIGIN).origin
  if (origin !== env.ALLOWED_ORIGIN || !origin.startsWith('https://'))
    return response('Origem inválida.', 503)
  const callback = `${url.origin}/callback`

  if (url.pathname === '/auth') {
    if (url.searchParams.get('provider') !== 'github')
      return response('Provedor inválido.', 400)
    if (url.searchParams.get('site_id') !== new URL(origin).hostname)
      return response('Site inválido.', 400)
    const state = random()
    const verifier = random()
    const challenge = base64url(
      new Uint8Array(
        await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(verifier),
        ),
      ),
    )
    const location = new URL('https://github.com/login/oauth/authorize')
    location.search = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: callback,
      scope: 'public_repo',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString()
    const session = base64url(
      new TextEncoder().encode(
        JSON.stringify({ state, verifier, created: Date.now() }),
      ),
    )
    return response(null, 302, {
      Location: location.toString(),
      'Set-Cookie': `${cookieName}=${session}; ${cookieOptions}; Max-Age=600`,
    })
  }

  if (url.pathname !== '/callback')
    return response('Página não encontrada.', 404)
  let session
  try {
    const value = request.headers
      .get('cookie')
      ?.split('; ')
      .find((item) => item.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1)
    session = JSON.parse(atob(value.replaceAll('-', '+').replaceAll('_', '/')))
  } catch {
    return response(
      'Sessão OAuth ausente ou inválida. Entre novamente pelo painel.',
      400,
      { 'Set-Cookie': clearCookie },
    )
  }
  const age = Date.now() - session.created
  if (
    !session.state ||
    !session.verifier ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > 600_000 ||
    session.state !== url.searchParams.get('state')
  ) {
    return response('Sessão OAuth inválida ou expirada.', 400, {
      'Set-Cookie': clearCookie,
    })
  }
  if (url.searchParams.has('error') || !url.searchParams.get('code'))
    return popup(origin, false, {
      message: 'Autorização cancelada. Tente novamente.',
    })

  try {
    const exchange = await fetcher(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        redirect: 'error',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: url.searchParams.get('code'),
          redirect_uri: callback,
          code_verifier: session.verifier,
        }),
      },
    )
    const data = await exchange.json()
    if (!exchange.ok || typeof data.access_token !== 'string' || data.error)
      throw new Error('exchange')
    const repository = await fetcher(
      `https://api.github.com/repos/${env.REPOSITORY}`,
      {
        redirect: 'error',
        headers: {
          ...githubHeaders,
          Authorization: `Bearer ${data.access_token}`,
        },
      },
    )
    const permissions = await repository.json()
    if (!repository.ok || permissions.permissions?.push !== true)
      return popup(origin, false, {
        message:
          'Sua conta precisa de permissão de escrita no repositório do Volátil.',
      })
    return popup(origin, true, { token: data.access_token, provider: 'github' })
  } catch {
    // Não registre respostas do GitHub: podem conter credenciais.
    return popup(origin, false, {
      message:
        'Não foi possível concluir o login. Tente novamente pelo painel.',
    })
  }
}

export default { fetch: (request, env) => handle(request, env) }
