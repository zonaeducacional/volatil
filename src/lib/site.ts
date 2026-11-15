import { config } from '../config'

export function siteDescription(locale: string) {
  const descriptions: Record<string, string> = config.description
  return descriptions[locale] ?? config.description.default
}

export function withBase(path: string) {
  return `${config.base}/${path.replace(/^\/+/, '')}`
}

export function withoutBase(path: string) {
  return path === config.base
    ? '/'
    : path.startsWith(`${config.base}/`)
      ? path.slice(config.base.length)
      : path
}
