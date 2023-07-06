import { expect } from 'chai'
import { delayFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'

describe('TwapLimitOrder.setFactory', () => {
  const loadFixture = setupFixtureLoader()

  it('is set correctly', async () => {
    const { limitOrder, factory } = await loadFixture(delayFixture)
    expect(await limitOrder.factory()).to.eq(factory.address)
  })
})
