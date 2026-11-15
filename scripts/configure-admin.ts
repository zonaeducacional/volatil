import { writeFileSync } from 'node:fs'

const value = process.env.DECAP_AUTH_URL?.trim() ?? ''
if (value) {
  const url = new URL(value)
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'DECAP_AUTH_URL deve ser uma origem HTTPS, sem caminho ou credenciais.',
    )
  }
}
writeFileSync(
  'dist/admin/oauth.json',
  `${JSON.stringify({ base_url: value.replace(/\/$/, '') })}\n`,
)
