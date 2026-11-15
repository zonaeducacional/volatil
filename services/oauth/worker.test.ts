import { describe, expect, test } from 'bun:test'
import { handle } from './worker.mjs'

const env = {
  GITHUB_CLIENT_ID: 'client-id-de-teste',
  GITHUB_CLIENT_SECRET: 'segredo-ficticio-de-teste',
  ALLOWED_ORIGIN: 'https://zonaeducacional.github.io',
  REPOSITORY: 'zonaeducacional/volatil',
}

async function start() {
  const result = await handle(
    new Request(
      'https://oauth.example/auth?provider=github&site_id=zonaeducacional.github.io&scope=repo',
    ),
    env,
  )
  return {
    cookie: result.headers.get('set-cookie')?.split(';')[0] ?? '',
    location: new URL(result.headers.get('location') ?? ''),
    result,
  }
}

function callback(cookie: string, state: string, extra = 'code=teste') {
  return new Request(`https://oauth.example/callback?state=${state}&${extra}`, {
    headers: { Cookie: cookie },
  })
}

describe('OAuth GitHub para Decap', () => {
  test('solicita somente public_repo, usa PKCE, estado aleatório e cookie protegido', async () => {
    const first = await start()
    const second = await start()
    expect(first.result.status).toBe(302)
    expect(first.location.origin).toBe('https://github.com')
    expect(first.location.searchParams.get('scope')).toBe('public_repo')
    expect(first.location.searchParams.get('code_challenge_method')).toBe(
      'S256',
    )
    expect(first.location.searchParams.get('redirect_uri')).toBe(
      'https://oauth.example/callback',
    )
    expect(first.location.searchParams.get('state')).not.toBe(
      second.location.searchParams.get('state'),
    )
    expect(first.result.headers.get('set-cookie')).toContain(
      'Secure; HttpOnly; SameSite=Lax',
    )
    expect(first.location.toString()).not.toContain(env.GITHUB_CLIENT_SECRET)
  })

  test('rejeita estado incorreto e cookie ausente antes de acessar o GitHub', async () => {
    const flow = await start()
    const neverFetch = () => {
      throw new Error('Não deve acessar o GitHub')
    }
    expect(
      (await handle(callback(flow.cookie, 'incorreto'), env, neverFetch))
        .status,
    ).toBe(400)
    expect(
      (await handle(callback('', 'incorreto'), env, neverFetch)).status,
    ).toBe(400)
  })

  test('rejeita sessão expirada', async () => {
    const value = btoa(
      JSON.stringify({
        state: 'estado',
        verifier: 'verificador',
        created: Date.now() - 601_000,
      }),
    )
    const result = await handle(
      callback(`__Host-volatil_oauth=${value}`, 'estado'),
      env,
    )
    expect(result.status).toBe(400)
  })

  test('valida permissão de escrita e entrega o token somente à origem configurada', async () => {
    const flow = await start()
    const calls: string[] = []
    const fetcher = async (url: string, options: RequestInit) => {
      calls.push(url)
      if (calls.length === 1) {
        const body = options.body as URLSearchParams
        expect(body.get('client_secret')).toBe(env.GITHUB_CLIENT_SECRET)
        const challenge = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(body.get('code_verifier') ?? ''),
        )
        expect(Buffer.from(challenge).toString('base64url')).toBe(
          flow.location.searchParams.get('code_challenge'),
        )
        return Response.json({ access_token: 'token-ficticio' })
      }
      expect(url).toBe('https://api.github.com/repos/zonaeducacional/volatil')
      expect((options.headers as Record<string, string>).Authorization).toBe(
        'Bearer token-ficticio',
      )
      return Response.json({ permissions: { push: true } })
    }
    const result = await handle(
      callback(flow.cookie, flow.location.searchParams.get('state') ?? ''),
      env,
      fetcher,
    )
    const html = await result.text()
    expect(calls).toHaveLength(2)
    expect(html).toContain('authorization:github:success:')
    expect(html).toContain('event.origin !== origin')
    expect(html).toContain('event.source !== window.opener')
    expect(html).toContain('https://zonaeducacional.github.io')
    expect(html).not.toContain("postMessage('*'")
    expect(html).not.toContain(env.GITHUB_CLIENT_SECRET)
    expect(result.headers.get('cache-control')).toBe('no-store')
    expect(result.headers.get('content-security-policy')).toContain(
      "default-src 'none'",
    )
    expect(result.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  test('não entrega token a usuário sem escrita', async () => {
    const flow = await start()
    let calls = 0
    const result = await handle(
      callback(flow.cookie, flow.location.searchParams.get('state') ?? ''),
      env,
      async () => {
        calls += 1
        return Response.json(
          calls === 1
            ? { access_token: 'token-nao-deve-aparecer' }
            : { permissions: { push: false } },
        )
      },
    )
    const html = await result.text()
    expect(html).toContain('authorization:github:error:')
    expect(html).not.toContain('token-nao-deve-aparecer')
  })

  test('rejeita provedor ou site diferente e informa configuração pendente', async () => {
    expect(
      (
        await handle(
          new Request('https://oauth.example/auth?provider=gitlab'),
          env,
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await handle(
          new Request(
            'https://oauth.example/auth?provider=github&site_id=evil.example',
          ),
          env,
        )
      ).status,
    ).toBe(400)
    expect(
      (await handle(new Request('https://oauth.example/health'), {})).status,
    ).toBe(503)
  })
})
