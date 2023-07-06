import { expect } from 'chai'
import { delayFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, INVALID_ADDRESS, MAX_UINT_32, overrides } from '../shared/utilities'

describe('TwapDelay._executeBuy', () => {
  const loadFixture = setupFixtureLoader()

  it('can be called only by itself', async () => {
    const { delay, wallet } = await loadFixture(delayFixture)

    await expect(
      delay._executeBuy(
        {
          token0: INVALID_ADDRESS,
          token1: INVALID_ADDRESS,
          value0: expandTo18Decimals(1),
          value1: expandTo18Decimals(1),
          unwrap: false,
          to: wallet.address,
          gasPrice: 0,
          gasLimit: 100000,
          validAfterTimestamp: MAX_UINT_32,
          priceAccumulator: 2222,
          timestamp: 1111,
          amountLimit0: 0,
          amountLimit1: 0,
          liquidity: 0,
          maxSwapPrice: 0,
          minSwapPrice: 0,
          orderId: 1,
          orderType: 3,
          swap: false,
        },
        overrides
      )
    ).to.be.revertedWith('TD00')
  })
})
