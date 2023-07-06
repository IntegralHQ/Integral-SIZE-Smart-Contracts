import { expect } from 'chai'

import { expandTo18Decimals, overrides } from '../shared/utilities'
import { pairFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { constants } from 'ethers'

describe('TwapPair.collect', () => {
  const loadFixture = setupFixtureLoader()

  it('can only be called by the factory', async () => {
    const { pair, wallet } = await loadFixture(pairFixture)
    await expect(pair.collect(wallet.address, overrides)).to.be.revertedWith('TP00')
  })

  it('clears the fees', async () => {
    const { token0, token1, pair, oracle, addLiquidity, setupUniswapPair, factory, getState, PRECISION, wallet } =
      await loadFixture(pairFixture)

    const token0Amount = expandTo18Decimals(500)
    const token1Amount = expandTo18Decimals(500)
    await addLiquidity(token0Amount, token1Amount)

    const swapFee = expandTo18Decimals(0.5)
    await factory.setSwapFee(token0.address, token1.address, swapFee, overrides)

    const { priceInfo } = await setupUniswapPair(1)
    const amountIn = expandTo18Decimals(1)
    await token1.transfer(pair.address, amountIn, overrides)
    const amountOut = await oracle.getSwapAmount0Out(await pair.swapFee(), amountIn, priceInfo)
    const swapFeeAmount = amountIn.mul(swapFee).div(PRECISION)

    await pair.swap(amountOut, 0, wallet.address, priceInfo, overrides)

    const stateBefore = await getState()
    await factory.collect(token0.address, token1.address, wallet.address, overrides)
    const stateAfter = await getState()

    expect(stateAfter.walletToken0Balance.sub(stateBefore.walletToken0Balance)).to.eq(0)
    expect(stateAfter.walletToken1Balance.sub(stateBefore.walletToken1Balance)).to.eq(swapFeeAmount)

    expect(stateBefore.fees[0].sub(stateAfter.fees[0])).to.eq(0)
    expect(stateBefore.fees[1].sub(stateAfter.fees[1])).to.eq(swapFeeAmount)
  })

  it('reverts if to is zero', async () => {
    const { factory, token0, token1 } = await loadFixture(pairFixture)
    await expect(factory.collect(token0.address, token1.address, constants.AddressZero, overrides)).to.revertedWith(
      'TP02'
    )
  })
})
