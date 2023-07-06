import { setupFixtureLoader } from '../shared/setup'
import { delayFixture } from '../shared/fixtures'
import { expect } from 'chai'
import { BigNumber } from 'ethers'

describe('TwapLimitOrder.setPairTolerance', () => {
  const loadFixture = setupFixtureLoader()

  it('init value', async () => {
    const { limitOrder, token0 } = await loadFixture(delayFixture)
    expect(await limitOrder.priceTolerance(token0.address)).to.eq(0)
  })

  it('is set correctly', async () => {
    const { limitOrder, token0 } = await loadFixture(delayFixture)
    await limitOrder.setPriceTolerance(token0.address, BigNumber.from(90))
    expect(await limitOrder.priceTolerance(token0.address)).to.eq(90)
  })
})
