export const config = {
  defaultLocale: 'pt-br',
  locales: ['pt-br'],
  title: 'Volátil',
  description: {
    default: 'Um espaço para compartilhar ideias, experiências e conhecimento.',
  },
  favicon: [{ href: '/volatil/favicon.svg', type: 'image/svg+xml' }],

  url: 'https://zonaeducacional.github.io',
  base: '/volatil',
  author: 'Volátil',
  blog: {
    // A positive integer, or 'all' to show every post.
    perPage: 10,
  } satisfies { perPage: number | 'all' },
  // Excalifont for Latin. Xiaolai, slightly larger, for other scripts.
  handwriting: true,
  nav: ['home', 'archive', 'tags', 'about'],
}
