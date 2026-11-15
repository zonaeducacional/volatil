window.CMS_MANUAL_INIT = true

async function start() {
  const status = document.getElementById('status')
  try {
    const response = await fetch('./oauth.json', { cache: 'no-store' })
    if (!response.ok) throw new Error('config')
    const { base_url: baseUrl } = await response.json()
    if (!baseUrl) {
      status.textContent =
        'O painel aguarda a conexão de login com o GitHub. Consulte o guia de configuração no repositório.'
      return
    }
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/decap-cms@3.17.3/dist/decap-cms.js'
    script.onload = () => {
      status.remove()
      window.CMS.init({ config: { backend: { base_url: baseUrl } } })
    }
    script.onerror = () => {
      status.textContent =
        'Não foi possível carregar o painel. Atualize a página para tentar novamente.'
    }
    document.body.append(script)
  } catch {
    status.textContent =
      'Não foi possível carregar a configuração do painel. Tente novamente em instantes.'
  }
}

start()
