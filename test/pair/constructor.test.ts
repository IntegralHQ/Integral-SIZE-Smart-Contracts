import { expect } from 'chai'

import { pairFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'

describe('TwapPair.constructor', () => {
  const loadFixture = setupFixtureLoader()

  it('correctly sets up the initial state', async () => {
    const { pair } = await loadFixture(pairFixture)
    expect(await pair.name()).to.eq('Twap LP')
    expect(await pair.symbol()).to.eq('TWAP-LP')
    expect(await pair.decimals()).to.eq(18)
  })
})
