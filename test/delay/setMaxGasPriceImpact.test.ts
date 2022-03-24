import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { delayFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'

describe('TwapDelay.setMaxGasPriceImpact', () => {
  const loadFixture = setupFixtureLoader()

  it('is 1_000_000 by default', async () => {
    const { delay } = await loadFixture(delayFixture)
    expect(await delay.maxGasPriceImpact()).to.eq(1_000_000)
  })

  it('cannot be set to same value', async () => {
    const { delay } = await loadFixture(delayFixture)
    await expect(delay.setMaxGasPriceImpact(1_000_000, overrides)).to.be.revertedWith('OS01')
  })

  it('cannot be greater than gasPriceInertia', async () => {
    const { delay } = await loadFixture(delayFixture)
    const gasPriceInertia = await delay.gasPriceInertia()
    await expect(delay.setMaxGasPriceImpact(gasPriceInertia.add(1), overrides)).to.be.revertedWith('OS33')
  })

  it('can be changed', async () => {
    const { delay, other } = await loadFixture(delayFixture)
    await expect(delay.connect(other.address).setMaxGasPriceImpact(500_000)).to.be.revertedWith('TD00')

    await expect(delay.setMaxGasPriceImpact(500_000, overrides))
      .to.emit(delay, 'MaxGasPriceImpactSet')
      .withArgs(BigNumber.from(500_000))
    expect(await delay.maxGasPriceImpact()).to.eq(500_000)
  })
})
