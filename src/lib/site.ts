import { config } from '../config'

export function siteDescription(locale: string) {
  const descriptions: Record<string, string> = config.description
  return descriptions[locale] ?? config.description.default
}

export function withBase(path: string) {
  const base = config.base.replace(/\/+$/, '')
  return `${base}/${path.replace(/^\/+/, '')}`
}

export function withoutBase(path: string) {
  const base = config.base.replace(/\/+$/, '')
  if (!base) return path
  return path === base
    ? '/'
    : path.startsWith(`${base}/`)
      ? path.slice(base.length)
      : path
}
