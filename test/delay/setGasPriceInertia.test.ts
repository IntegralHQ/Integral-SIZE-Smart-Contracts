import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { delayFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'

describe('TwapDelay.setGasPriceInertia', () => {
  const loadFixture = setupFixtureLoader()

  it('is 20_000_000 by default', async () => {
    const { delay } = await loadFixture(delayFixture)
    expect(await delay.gasPriceInertia()).to.eq(20_000_000)
  })

  it('cannot be set to same value', async () => {
    const { delay } = await loadFixture(delayFixture)
    await expect(delay.setGasPriceInertia(20_000_000, overrides)).to.be.revertedWith('OS01')
  })

  it('cannot be set to 0', async () => {
    const { delay } = await loadFixture(delayFixture)
    await expect(delay.setGasPriceInertia(0, overrides)).to.be.revertedWith('OS35')
  })

  it('can be changed', async () => {
    const { delay, other } = await loadFixture(delayFixture)
    await expect(delay.connect(other).setGasPriceInertia(1_000_000, overrides)).to.be.revertedWith('TD00')

    await expect(delay.setGasPriceInertia(1_000_000, overrides))
      .to.emit(delay, 'GasPriceInertiaSet')
      .withArgs(BigNumber.from(1_000_000))
    expect(await delay.gasPriceInertia()).to.eq(1_000_000)
  })
})
