import { expect } from 'chai'
import { delayFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { INVALID_ADDRESS, MAX_UINT_32, overrides } from '../shared/utilities'

describe('TwapDelay._executeWithdraw', () => {
  const loadFixture = setupFixtureLoader()

  it('can be called only by itself', async () => {
    const { delay, wallet } = await loadFixture(delayFixture)

    await expect(
      delay._executeWithdraw(
        {
          token0: INVALID_ADDRESS,
          token1: INVALID_ADDRESS,
          liquidity: 0,
          value0: 0,
          value1: 0,
          unwrap: false,
          to: wallet.address,
          gasPrice: 0,
          gasLimit: 0,
          validAfterTimestamp: MAX_UINT_32,
          amountLimit0: 0,
          amountLimit1: 0,
          maxSwapPrice: 0,
          minSwapPrice: 0,
          orderId: 1,
          orderType: 2,
          priceAccumulator: 0,
          swap: false,
          timestamp: 0,
        },
        overrides
      )
    ).to.be.revertedWith('TD00')
  })
})
