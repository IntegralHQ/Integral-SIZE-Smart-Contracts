import { expect } from 'chai'
import { delayFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'

describe('TwapLimitOrder.setBlockTime', () => {
  const loadFixture = setupFixtureLoader()

  it('default block time is 10 seconds', async () => {
    const { limitOrder } = await loadFixture(delayFixture)
    expect(await limitOrder.secondsPerBlock()).to.eq(10)
  })

  it('can be changed', async () => {
    const { limitOrder } = await loadFixture(delayFixture)
    await limitOrder.setSecondsPerBlock(12)
    expect(await limitOrder.secondsPerBlock()).to.eq(12)
  })

  it('performs checks', async () => {
    const { limitOrder, other } = await loadFixture(delayFixture)
    await expect(limitOrder.setSecondsPerBlock(10, overrides)).to.be.revertedWith('TL01')
    await expect(limitOrder.connect(other).setSecondsPerBlock(20, overrides)).to.be.revertedWith('TL00')
  })
})
