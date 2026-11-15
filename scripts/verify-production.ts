import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'

const folder = 'src/content/blog/pt-br'
const published = `${folder}/verificacao-publicado.md`
const draft = `${folder}/verificacao-rascunho.md`
for (const file of [published, draft])
  assert(!existsSync(file), `Já existe: ${file}`)

try {
  for (const [file, hidden] of [
    [published, false],
    [draft, true],
  ] as const) {
    writeFileSync(
      file,
      `---\ntitle: Verificação ${hidden ? 'rascunho' : 'publicado'}\ndescription: Conteúdo temporário de teste.\npubDate: 2026-11-15\ndraft: ${hidden}\ntags: [verificacao]\ncategory: Testes\n---\n\nTeste editorial com imagem.\n\n![Teste](/volatil/favicon.svg)\n`,
    )
  }
  const result = spawnSync('bun', ['run', 'build'], { stdio: 'inherit' })
  assert.equal(result.status, 0, 'Build com artigos de teste')
  assert(existsSync('dist/posts/verificacao-publicado/index.html'))
  assert(!existsSync('dist/posts/verificacao-rascunho/index.html'))
  for (const file of [
    'dist/index.html',
    'dist/posts/index.html',
    'dist/rss.xml',
    'dist/posts/tag/verificacao/index.html',
    'dist/posts/category/testes/index.html',
  ]) {
    const html = readFileSync(file, 'utf8')
    assert(
      html.includes('verificacao-publicado'),
      `Artigo publicado ausente: ${file}`,
    )
    assert(!html.includes('verificacao-rascunho'), `Rascunho exposto: ${file}`)
  }
  assert.match(readFileSync('dist/index.html', 'utf8'), /lang="pt-br"/i)
  assert(
    readFileSync('dist/rss.xml', 'utf8').includes('<language>pt-br</language>'),
  )
  assert(existsSync('dist/about/index.html'))
  assert(existsSync('dist/admin/index.html'))
  const cms = Bun.YAML.parse(readFileSync('dist/admin/config.yml', 'utf8')) as {
    backend: { name: string; repo: string }
    public_folder: string
    publish_mode: string
    collections: { folder: string }[]
  }
  assert.equal(cms.backend.name, 'github')
  assert.equal(cms.publish_mode, 'editorial_workflow')
  assert.equal(cms.collections[0].folder, folder)
  assert.equal(cms.public_folder, '/volatil/images/uploads')
  assert.equal(cms.backend.repo, 'zonaeducacional/volatil')
  const root = readFileSync('dist/index.html', 'utf8')
  assert(root.includes('https://zonaeducacional.github.io/volatil/'))
  assert(!root.includes('/volatil/volatil/'))
  for (const file of new Bun.Glob('**/*.html').scanSync('dist')) {
    const html = readFileSync(`dist/${file}`, 'utf8')
    for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
      let target = match[1]
      if (target.startsWith('https://zonaeducacional.github.io/'))
        target = new URL(target).pathname
      if (!target.startsWith('/') || target.startsWith('//')) continue
      assert(
        target.startsWith('/volatil/'),
        `Link fora da base: ${target} em ${file}`,
      )
      const path = `dist/${decodeURIComponent(target.slice('/volatil/'.length)).split(/[?#]/)[0]}`
      assert(
        existsSync(path) || existsSync(`${path}/index.html`),
        `Link local ausente: ${target}`,
      )
    }
  }
  const css = [...new Bun.Glob('_astro/*.css').scanSync('dist')]
    .map((file) => readFileSync(`dist/${file}`, 'utf8'))
    .join('')
  assert(css.includes('/volatil/fonts/'))
  assert(css.includes('/volatil/noise.png'))
  assert(!/url\(["']?\/(?:fonts|noise)/.test(css))
  assert(existsSync('dist/.nojekyll'))
  const oauth = JSON.parse(readFileSync('dist/admin/oauth.json', 'utf8'))
  assert.equal(
    oauth.base_url,
    (process.env.DECAP_AUTH_URL ?? '').trim().replace(/\/$/, ''),
  )
  console.log(
    'Produção verificada: português, rotas, RSS, taxonomias, rascunhos e painel.',
  )
} finally {
  for (const file of [published, draft]) if (existsSync(file)) unlinkSync(file)
  const result = spawnSync('bun', ['run', 'build'], { stdio: 'inherit' })
  if (result.status !== 0) process.exitCode = 1
}
