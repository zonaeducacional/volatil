import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

test('o painel salva artigos com publicação liberada e preserva o conteúdo', async () => {
  let listener:
    | {
        name: string
        handler: (event: {
          entry: Map<string, unknown>
        }) => Map<string, unknown>
      }
    | undefined
  const calls: string[] = []
  const window = {
    CMS: {
      registerEventListener(event: typeof listener) {
        listener = event
        calls.push('register')
      },
      init() {
        calls.push('init')
      },
    },
  }
  const document = {
    getElementById: () => ({ remove() {} }),
    createElement: () => ({}),
    body: {
      append(script: { onload: () => void }) {
        script.onload()
      },
    },
  }
  await runInNewContext(readFileSync('public/admin/bootstrap.js', 'utf8'), {
    window,
    document,
    fetch: async () => ({
      ok: true,
      json: async () => ({ base_url: 'https://oauth.example' }),
    }),
  })
  expect(calls).toEqual(['register', 'init'])
  expect(listener?.name).toBe('preSave')
  const data = new Map<string, unknown>([
    ['draft', true],
    ['title', 'Artigo do usuário'],
    ['body', 'Texto original'],
  ])
  const entry = new Map<string, unknown>([['data', data]])
  const saved = listener?.handler({ entry })
  expect(saved?.get('draft')).toBe(false)
  expect(saved?.get('title')).toBe('Artigo do usuário')
  expect(saved?.get('body')).toBe('Texto original')
  const config = Bun.YAML.parse(
    readFileSync('public/admin/config.yml', 'utf8'),
  ) as {
    publish_mode: string
    collections: { fields: { name: string; widget: string }[] }[]
  }
  expect(config.publish_mode).toBe('editorial_workflow')
  for (const collection of config.collections) {
    expect(
      collection.fields.find((field) => field.name === 'draft')?.widget,
    ).toBe('hidden')
  }
})
