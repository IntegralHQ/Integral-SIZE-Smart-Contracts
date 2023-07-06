import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { delayFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'

describe('TwapLimitOrder.setMaxGasLimit', () => {
  const loadFixture = setupFixtureLoader()

  it('is 5M by default', async () => {
    const { limitOrder } = await loadFixture(delayFixture)
    expect(await limitOrder.maxGasLimit()).to.eq(5_000_000)
  })

  it('cannot be set to same value', async () => {
    const { limitOrder } = await loadFixture(delayFixture)
    await expect(limitOrder.setMaxGasLimit(5_000_000, overrides)).to.be.revertedWith('TL01')
  })

  it('can be changed', async () => {
    const { limitOrder, other } = await loadFixture(delayFixture)
    await expect(limitOrder.connect(other).setMaxGasLimit(1, overrides)).to.be.revertedWith('TL00')

    await expect(limitOrder.setMaxGasLimit(1, overrides))
      .to.emit(limitOrder, 'MaxGasLimitSet')
      .withArgs(BigNumber.from(1))
    expect(await limitOrder.maxGasLimit()).to.eq(1)
  })

  it('limit to block gas limit', async () => {
    const { limitOrder } = await loadFixture(delayFixture)
    await expect(limitOrder.setMaxGasLimit(11_000_000, overrides)).to.be.revertedWith('TL2B')
  })
})
