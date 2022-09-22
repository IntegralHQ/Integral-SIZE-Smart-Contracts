import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { delayFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { DELAY, overrides } from '../shared/utilities'

describe('TwapDelay.setDelay', () => {
  const loadFixture = setupFixtureLoader()

  it('is set correctly', async () => {
    const { delay } = await loadFixture(delayFixture)
    expect(await delay.delay()).to.eq(DELAY)
  })

  it('can be changed', async () => {
    const { delay, other } = await loadFixture(delayFixture)
    await expect(delay.connect(other).setDelay(2 * DELAY, overrides)).to.be.revertedWith('TD00')

    await expect(delay.setDelay(2 * DELAY, overrides))
      .to.emit(delay, 'DelaySet')
      .withArgs(BigNumber.from(2 * DELAY))
    expect(await delay.delay()).to.eq(2 * DELAY)
  })

  it.skip('cannot be set to same value', async () => {
    const { delay } = await loadFixture(delayFixture)
    await expect(delay.setDelay(DELAY, overrides)).to.be.revertedWith('TD01')
  })
})
