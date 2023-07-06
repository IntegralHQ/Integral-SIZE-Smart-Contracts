import { expect } from 'chai'
import { delayFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { BigNumber, utils } from 'ethers'

describe('TwapLimitOrder.setGasMultiplier', () => {
  const loadFixture = setupFixtureLoader()

  it('is set correctly', async () => {
    const { limitOrder } = await loadFixture(delayFixture)
    expect(await limitOrder.gasMultiplier()).to.eq(utils.parseUnits('2'))
  })

  it('can be changed', async () => {
    const { limitOrder } = await loadFixture(delayFixture)
    await limitOrder.setGasMultiplier(BigNumber.from('1'))
    expect(await limitOrder.gasMultiplier()).to.eq(BigNumber.from('1'))
  })

  it('emit with event', async () => {
    const { limitOrder } = await loadFixture(delayFixture)
    await expect(limitOrder.setGasMultiplier(BigNumber.from('1')))
      .to.emit(limitOrder, 'GasMultiplierSet')
      .withArgs(BigNumber.from('1'))
  })
})
