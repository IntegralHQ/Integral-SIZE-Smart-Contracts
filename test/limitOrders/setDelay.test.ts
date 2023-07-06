import { expect } from 'chai'
import { delayFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'

describe('TwapLimitOrder.setDelay', () => {
  const loadFixture = setupFixtureLoader()

  it('is set correctly', async () => {
    const { limitOrder, delay } = await loadFixture(delayFixture)
    expect(await limitOrder.delay()).to.eq(delay.address)
  })
})
