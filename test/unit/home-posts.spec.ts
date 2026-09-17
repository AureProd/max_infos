import { describe, expect, it } from 'vitest'
import { postsWorthShowing } from '../../shared/utils/social'

/**
 * What the home page shows of the posts belonging to no account.
 *
 * Two opposite failures have already happened here. Posts added by hand had
 * NO section at all and sat invisible in production. Then every one of them
 * got a section — LinkedIn included, whose posts carry neither title nor
 * image because no API will ever hand them over, and which therefore landed
 * on the home page as bare plates.
 *
 * The rule in between: a loose post shows only if its network is one the
 * site actually has a connected account for. LinkedIn goes to the article
 * it illustrates, not to the front page.
 */
const post = (id: number, network: 'instagram' | 'linkedin') => ({ id, network })

describe('the loose posts on the home page', () => {
  it('keeps a hand-added post of a network that has an account', () => {
    const kept = postsWorthShowing([post(1, 'instagram')], ['instagram'])
    expect(kept.map((p) => p.id)).toEqual([1])
  })

  it('leaves out a network with no connected account', () => {
    const kept = postsWorthShowing([post(1, 'instagram'), post(2, 'linkedin')], ['instagram'])
    expect(kept.map((p) => p.id)).toEqual([1])
  })

  it('shows nothing at all when no account is connected', () => {
    // Otherwise the very first visit displays a section of bare plates.
    expect(postsWorthShowing([post(1, 'instagram')], [])).toEqual([])
  })
})
