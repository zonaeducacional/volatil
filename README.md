# Volátil

Blog em português brasileiro, baseado no [Astro Air](https://github.com/sun0225SUN/astro-air), com publicação automática no GitHub Pages e painel Decap CMS.

- Site: https://zonaeducacional.github.io/volatil/
- Painel: https://zonaeducacional.github.io/volatil/admin/
- Código: https://github.com/zonaeducacional/volatil
- [Guia de operação e ativação do login](docs/operacao-pt-br.md)
- [Origem, alterações e licença](UPSTREAM.md)

## Desenvolvimento

Requer **Bun 1.4.4**. O lockfile fixa Astro 7.4.12.

```sh
bun install --frozen-lockfile
bun run dev --background
bun run test
bun run build
```

O build estático fica em `dist/`. Os testes verificam OAuth, links com a base
`/volatil/`, RSS, categorias, tags e exclusão de rascunhos em produção.

## Conteúdo

Artigos: `src/content/blog/pt-br/*.md`. Páginas: `src/content/pages/pt-br/*.md`.
Imagens enviadas pelo painel: `public/images/uploads/`. Configuração do site:
`src/config.ts`. Tradução: `messages/pt-br.json`.

A branch `main` dispara build e publicação via GitHub Actions. Pull requests
executam os testes sem publicar. O fluxo editorial do Decap mantém rascunhos
em branches/PRs e publica por merge na `main`.

## Ativação do painel

O GitHub Pages serve os arquivos estáticos. O login GitHub requer um serviço
OAuth separado. O código pronto está em `services/oauth/worker.mjs`, destinado
ao plano gratuito de Cloudflare Workers. Antes da ativação, `/admin/` informa
que o login está pendente; não tenta usar um provedor incorreto.

Siga o guia para criar a OAuth App no GitHub, configurar os secrets no Worker
e definir a variável pública `DECAP_AUTH_URL` no repositório. Nenhuma senha,
Client Secret ou token deve entrar no código ou nas variáveis públicas.

## Licença

**GPL-3.0-only**. Consulte [LICENSE](LICENSE) e [UPSTREAM.md](UPSTREAM.md).
Créditos originais do Astro Air e seu histórico Git foram preservados.
