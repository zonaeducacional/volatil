# Operação do Volátil

## Endereços e arquitetura

- Site: https://volatil.vibelab.app.br/
- Painel: https://volatil.vibelab.app.br/admin/
- Repositório: https://github.com/zonaeducacional/volatil
- Tema de origem: Astro Air 0.0.1, commit `08f9e3995e1420c0a951330ac8016c8c6cbe146d`.
- Runtime de build: Bun 1.4.4; Astro 7.4.12, fixado no lockfile.

GitHub guarda código, Markdown e imagens. GitHub Actions constrói e publica
`dist/` no GitHub Pages em cada push na `main`. Pull requests executam os
mesmos testes sem publicar nem expor seus rascunhos no site.

O GitHub Pages não executa um servidor OAuth. Para o login do Decap, o projeto
inclui um pequeno Cloudflare Worker. Seu uso não muda o endereço nem a
hospedagem do site. A ativação requer a conta Cloudflare e a criação de uma
OAuth App na conta GitHub do proprietário. Até isso ocorrer, o painel informa
que o login está pendente.

## Desenvolvimento

Instale Bun 1.4.4 e execute:

```sh
bun install --frozen-lockfile
bun run dev --background
bun run test
bun run build
```

AGENTS.md determina o servidor em modo background. Gerencie-o com
`bun run astro dev status`, `bun run astro dev logs` e `bun run astro dev stop`.

`bun run test` executa nove testes OAuth, um teste do painel e um teste de produção. O teste de
produção cria artigos temporários, verifica URLs, idioma, RSS, categorias,
tags e exclusão de rascunhos, remove os arquivos e reconstrói. Não execute
simultaneamente com outra edição ou build.

O idioma padrão `pt-br` é servido em `/`, sem prefixo de idioma.
As traduções e os exemplos originais estão preservados, com os outros idiomas
desabilitados. Ajustes de identidade ficam em `src/config.ts`.

## Estado da ativação

O Worker foi publicado em `https://volatil-oauth.zonaeducacional.workers.dev`.
A OAuth App e os dois secrets estão configurados. A variável de repositório
`DECAP_AUTH_URL` aponta para esse Worker, e o painel usa o login GitHub.
O endpoint `/health` confirmou `configured: true`; a validação final do login
é feita pelo proprietário ao entrar no painel.
A URL de callback definitiva é
`https://volatil-oauth.zonaeducacional.workers.dev/callback`.

Neste computador, Wrangler 4.162.0 está instalado em `.tools/cloudflare`
(pasta ignorada pelo Git). Após criar a OAuth App, execute em um terminal:

```sh
cd /home/sergio/Projetos/astro-air-ptbr
python3 scripts/configure-oauth-secrets.py
```

O programa solicita Client ID e Client Secret (oculto), envia ambos diretamente
aos secrets do Worker e não grava as credenciais em arquivos. Ao terminar,
avise ao Codex para verificar `/health`, configurar `DECAP_AUTH_URL` e reconstruir
o site. Não cole o Client Secret no chat.

Se precisar reinstalar o CLI local, use Node 24 e
`npm install --prefix .tools/cloudflare wrangler@4.162.0 --no-audit --no-fund`.

## Ativar o login: etapas na sua conta

### 1. Criar o Worker gratuito

No painel https://dash.cloudflare.com/, entre em Workers & Pages, crie um
Worker chamado `volatil-oauth` e publique o exemplo inicial para reservar um
endereço `https://volatil-oauth.SEUSUBDOMINIO.workers.dev`.

Em Edit code, substitua o exemplo pelo conteúdo completo de
`services/oauth/worker.mjs` e publique. Esse módulo não exige dependências,
KV, banco, domínio próprio ou plano pago.

Em Settings → Variables and Secrets, adicione:

| Nome | Tipo | Valor |
| --- | --- | --- |
| `ALLOWED_ORIGIN` | Texto | `https://volatil.vibelab.app.br` |
| `REPOSITORY` | Texto | `zonaeducacional/volatil` |

Alternativamente, com Wrangler autenticado, a configuração de deploy está em
`services/oauth/wrangler.toml`. Não inclua credenciais nesse arquivo.

### 2. Criar a OAuth App no GitHub

Abra https://github.com/settings/applications/new e preencha:

- Application name: `Volátil CMS`.
- Homepage URL: `https://volatil.vibelab.app.br/`.
- Authorization callback URL: `https://volatil-oauth.SEUSUBDOMINIO.workers.dev/callback`.

Use o endereço real do seu Worker. Gere um Client Secret e copie-o diretamente
para os secrets do Worker, sem colá-lo no chat ou no repositório.

Adicione no Cloudflare Worker:

| Nome | Tipo | Valor |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | Secret | Client ID da OAuth App |
| `GITHUB_CLIENT_SECRET` | Secret | Client Secret da OAuth App |

Publique a nova configuração. Abra `https://SEU-WORKER/health`: deve retornar
`{"configured":true}`. Esse endpoint verifica a presença das configurações;
o login real verifica se o Client ID e o Secret estão corretos.

O serviço solicita `public_repo`, usa estado de sessão e PKCE, valida escrita
no repositório e entrega o token somente à origem configurada. Cookies de
sessão são Secure/HttpOnly e expiram em dez minutos. O serviço não registra
tokens ou respostas da troca OAuth. Não habilite logging do corpo de requisições.

### 3. Conectar o painel ao Worker

No repositório, abra Settings → Secrets and variables → Actions → Variables:
https://github.com/zonaeducacional/volatil/settings/variables/actions

Crie uma **Repository variable** chamada `DECAP_AUTH_URL` com a origem pública
do Worker, por exemplo `https://volatil-oauth.SEUSUBDOMINIO.workers.dev`.
Essa URL é pública e não é um segredo. Não coloque tokens ou Client Secret aqui.

Em Actions, execute novamente “Publicar Volátil no GitHub Pages”, pela opção
Run workflow. O build gera `admin/oauth.json` com essa URL e o painel passa a
abrir o login GitHub. A variável não altera arquivos de código nem contém
credenciais. Em desenvolvimento local, a mesma variável pode ser definida
apenas no ambiente antes de `bun run build`.

### 4. Testar com sua conta

Acesse `/admin/`, entre pelo GitHub e autorize a OAuth App. Os editores
precisam de permissão de escrita no repositório. Crie um artigo de teste com
imagem, salve como rascunho e confirme que não aparece no site público.
Publique-o e acompanhe a execução no Actions; confirme o artigo e a imagem no
site. Edite e publique novamente para verificar a atualização automática.

Sem as etapas acima, não é possível validar o login de ponta a ponta. Os
testes automatizados locais usam respostas simuladas do GitHub.

## Escrever e publicar

Em Artigos, preencha título, resumo, data, categoria, tags e conteúdo. Use o
editor Markdown para inserir imagens; uploads ficam em `public/images/uploads`
e os links públicos começam por `/images/uploads`.

O fluxo editorial mantém novos artigos em branches/PRs e publica por merge
na `main`. Use os estados Rascunho, Em revisão e Pronto para publicar para
organizar o conteúdo. Ao publicar, aguarde o build terminar antes de abrir o
artigo no site; durante a publicação o endereço novo ainda pode retornar 404.

O painel grava `draft: false` automaticamente, pois o rascunho já é protegido
pela branch editorial. O campo técnico fica oculto para não contradizer a ação
Publicar. Arquivos editados diretamente no código continuam aceitando
`draft: true`, que exclui o conteúdo de todas as páginas e do RSS em produção.

A data organiza os artigos; não há agendamento automático por data futura.
Páginas permite editar Sobre. Para novas páginas, adicione o arquivo no código
e sua entrada em `config.nav`. O painel edita Markdown; componentes MDX
originais continuam disponíveis para edição no código.

Os links internos escritos no Markdown devem incluir `/`. O projeto
verifica links e assets gerados para evitar caminhos quebrados no Pages.

## Publicação e manutenção

A configuração de Pages deve usar GitHub Actions como source. A publicação usa
as permissões `pages: write` e `id-token: write` do `GITHUB_TOKEN` temporário:
não é necessário criar um token pessoal ou segredo para deploy.

O plano gratuito do GitHub Pages requer este repositório público. Cloudflare
Workers também oferece plano gratuito, sujeito aos limites vigentes. Nenhum
plano pago é necessário para esta arquitetura inicial.

Para reverter conteúdo, reverta o commit no GitHub; a `main` será reconstruída.
Regras de proteção da branch precisam permitir o fluxo de publicação do Decap.
Imagens e histórico permanecem no Git; exclusão de um arquivo não o remove do
histórico. Não use o repositório público para conteúdo confidencial.

Preserve LICENSE, UPSTREAM.md e os avisos originais. O código modificado mantém
GPL-3.0-only. Confira autoria e direitos de imagens e textos antes de adicioná-los.
Atualize dependências e a versão fixa do Decap somente após rodar os testes.
Para atualizar o tema, use uma branch e revise os conflitos sem sobrescrever
alterações locais. O remote `upstream` aponta para o tema original; `origin`
aponta para `zonaeducacional/volatil`.

## Fontes oficiais

- https://docs.astro.build/en/guides/deploy/github/
- https://decapcms.org/docs/github-backend/
- https://decapcms.org/docs/manual-initialization/
- https://decapcms.org/docs/editorial-workflows/
- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/configuration/secrets/

## Diagnóstico OAuth

As requisições ao GitHub usam `redirect: manual`, compatível com Cloudflare
Workers, e não seguem redirecionamentos com credenciais. Erros conhecidos
recebem mensagens específicas; corpos de erro, tokens e secrets não são
exibidos nem registrados.

## Migração para o domínio próprio

Destino: `https://volatil.vibelab.app.br/`, com painel em `/admin/`.
A branch `feat/volatil-custom-domain` prepara a migração e não muda a produção
enquanto não for integrada à main. A autorização atual do Wrangler consegue
publicar o Worker, mas a API de registros DNS retorna HTTP 403.

Registro necessário na zona Cloudflare `vibelab.app.br`:

| Tipo | Nome | Destino | Proxy | TTL |
| --- | --- | --- | --- | --- |
| CNAME | volatil | zonaeducacional.github.io | Somente DNS (nuvem cinza) | Auto |

Antes de criar ou alterar o registro, consulte os registros exatos existentes
para `volatil.vibelab.app.br`. Não substitua registros que sustentem outro
serviço sem revisar sua finalidade. O destino do CNAME não inclui `/volatil`.

Na mudança coordenada:

1. Cadastre `volatil.vibelab.app.br` em Settings → Pages → Custom domain no
   repositório `zonaeducacional/volatil`.
2. Crie o registro CNAME na Cloudflare ou ajuste o registro específico após
   verificar que ele corresponde a este site.
3. Integre a branch de migração e aguarde o workflow de publicação.
4. Publique a configuração do Worker em `services/oauth/wrangler.toml`, que
   altera `ALLOWED_ORIGIN` para o domínio novo, preservando os dois secrets.
5. Aguarde o certificado do GitHub Pages e habilite Enforce HTTPS. Valide o
   site, o artigo publicado, os assets, o RSS e o painel no domínio novo.
6. Atualize a Homepage URL da OAuth App GitHub para o endereço novo. O callback
   continua `https://volatil-oauth.zonaeducacional.workers.dev/callback`; não é
   necessário gerar novas credenciais.

O GitHub informa que DNS e disponibilização do HTTPS podem levar até 24 horas.
Não ative a configuração de domínio do GitHub antes de coordenar a mudança de
DNS, pois o endereço antigo passa a redirecionar para o endereço novo.

### Autorizar o acesso DNS para a migração

Em https://dash.cloudflare.com/profile/api-tokens, crie um token usando o
modelo **Edit zone DNS**. Mantenha a permissão **Zone → DNS → Edit** e restrinja
**Zone Resources → Include → Specific zone → vibelab.app.br**. A conta não
precisa conceder edição de outras zonas. Pode definir validade curta para
esta migração.

Depois de criar e copiar o token, execute neste computador:

```sh
cd /home/sergio/Projetos/astro-air-ptbr
python3 scripts/connect-cloudflare-dns.py
```

O programa recebe o token com entrada oculta, verifica acesso aos registros do
subdomínio e guarda a credencial em `~/.config/volatil/cloudflare-dns-token`,
fora do checkout, com permissão 600 e diretório 700. Não altera DNS nessa etapa.
O token não deve ser enviado ao chat, ao GitHub ou a variáveis públicas.
Após a migração, remova a cópia local dedicada; o proprietário pode revogar o
token no painel Cloudflare.
