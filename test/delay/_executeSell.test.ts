import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { delayFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, MAX_UINT_32, overrides } from '../shared/utilities'

describe('TwapDelay._executeSell', () => {
  const loadFixture = setupFixtureLoader()

  it('can be called only by itself', async () => {
    const { delay, wallet } = await loadFixture(delayFixture)

    await expect(
      delay._executeSell(
        {
          pairId: 0,
          inverse: false,
          shareIn: expandTo18Decimals(1),
          amountOutMin: expandTo18Decimals(1),
          unwrap: false,
          to: wallet.address,
          gasPrice: 0,
          gasLimit: 100000,
          validAfterTimestamp: MAX_UINT_32,
          priceAccumulator: BigNumber.from('22222'),
          timestamp: 1111,
        },
        overrides
      )
    ).to.be.revertedWith('TD00')
  })
})
