import { expect } from 'chai'

import { expandTo18Decimals, overrides } from '../shared/utilities'
import { pairFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'

describe('TwapPair.setSwapFee', () => {
  const loadFixture = setupFixtureLoader()

  it('can only be called by the factory', async () => {
    const { pair } = await loadFixture(pairFixture)
    await expect(pair.setSwapFee(1111, overrides)).to.be.revertedWith('TP00')
  })

  it('cannot be set to same value', async () => {
    const { pair, factory, token0, token1 } = await loadFixture(pairFixture)
    const fee = await pair.swapFee()
    await expect(factory.setSwapFee(token0.address, token1.address, fee, overrides)).to.be.revertedWith('TP01')
  })

  it('swap uses newly set swap fee', async () => {
    const { factory, pair, token0, token1, addLiquidity, oracle, PRECISION, wallet, setupUniswapPair } =
      await loadFixture(pairFixture)
    const newSwapFee = expandTo18Decimals(0.002)

    await expect(factory.setSwapFee(token0.address, token1.address, newSwapFee, overrides))
      .to.emit(pair, 'SetSwapFee')
      .withArgs(newSwapFee)
    expect(await pair.swapFee()).to.eq(newSwapFee)

    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    const amount0 = expandTo18Decimals(1)
    const feeAmount = amount0.mul(newSwapFee).div(PRECISION)
    const effectiveAmount0 = amount0.sub(feeAmount)

    await addLiquidity(token0Amount, token1Amount)
    const { priceInfo } = await setupUniswapPair(2)
    const token1After = await oracle.tradeX(token0Amount.add(effectiveAmount0), token0Amount, token1Amount, priceInfo)

    const expectedOutputAmount = token1Amount.sub(token1After)
    await token0.transfer(pair.address, amount0, overrides)
    await pair.swap(0, expectedOutputAmount, wallet.address, priceInfo, overrides)
  })
})
