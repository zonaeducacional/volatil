import { defineMiddleware } from 'astro:middleware'
import { defaultLang, isLocale } from './i18n'
import { withBase, withoutBase } from './lib/site'

// The default locale from src/config.ts is served at `/`. Pages are still
// rendered from the /<locale> route, so unprefixed requests are rewritten
// there without changing the address.
export const onRequest = defineMiddleware((context, next) => {
  const pathname = withoutBase(context.url.pathname)
  if (pathname.includes('.')) return next()
  const segment = pathname.split('/').filter(Boolean)[0]
  if (segment && isLocale(segment)) return next()
  const target =
    pathname === '/' ? `/${defaultLang}/` : `/${defaultLang}${pathname}`
  return context.rewrite(withBase(target))
})
