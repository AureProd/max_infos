/**
 * Identité du site, en dur.
 *
 * TEMPORAIRE : au lot 3 ces données passent en base (table `setting`, clés
 * `identity`, `contact` et `cv`) et ce file disparaît au profit de
 * `GET /api/site`. Il est typé dès maintenant pour que la bascule se fasse
 * sans surprise.
 */

export interface SiteLink {
  label: string
  value: string
  href: string
}

export interface SiteSkillGroup {
  group: string
  items: string[]
}

export interface Site {
  name: string
  author: string
  byline: string
  tagline: string
  pitch: string
  instagram: { handle: string; url: string; posts: number; followers: number | null }
  linkedin: { handle: string; url: string }
  substack: string
  links: SiteLink[]
  skills: SiteSkillGroup[]
}

export const SITE: Site = {
  name: "Un Max d'info",
  author: 'Maximilien Huet',
  byline: 'Max',
  tagline: "Comprendre ce que l'actualité ne prend pas le temps d'expliquer.",
  pitch:
    "Enquêtes et analyses au long cours sur le pouvoir, la mémoire et les identités. Publié d'abord en newsletter, décliné en formats courts.",
  instagram: {
    handle: '@unmaxdinfo_',
    url: 'https://www.instagram.com/unmaxdinfo_',
    posts: 2,
    followers: null,
  },
  linkedin: {
    handle: 'Maximilien Huet',
    url: 'https://www.linkedin.com/in/maximilien-huet-68664823b/',
  },
  substack: 'https://unmaxdinfo.substack.com/',
  links: [
    { label: 'Newsletter', value: 'Substack', href: 'https://unmaxdinfo.substack.com/' },
    { label: 'Instagram', value: '@unmaxdinfo_', href: 'https://www.instagram.com/unmaxdinfo_' },
    {
      label: 'LinkedIn',
      value: 'Maximilien Huet',
      href: 'https://www.linkedin.com/in/maximilien-huet-68664823b/',
    },
  ],
  skills: [
    {
      group: 'Journalisme',
      items: ['Enquête', 'Format long', 'Vérification', 'Entretien', 'Synthèse'],
    },
    {
      group: 'Domaines',
      items: [
        'Géopolitique',
        'Mémoire et histoire',
        'Sport et pouvoir',
        'Cultures urbaines',
        'Numérique',
      ],
    },
    { group: 'Diffusion', items: ['Newsletter', 'LinkedIn', 'Instagram', 'Édition web'] },
  ],
}
