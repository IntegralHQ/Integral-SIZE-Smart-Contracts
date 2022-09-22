import { expect } from 'chai'

import { expandTo18Decimals, overrides } from '../shared/utilities'
import { pairFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'

describe('TwapPair.getSwapAmount0Out', () => {
  const loadFixture = setupFixtureLoader()

  it('returns the number of token0 swapped for token1', async () => {
    const { addLiquidity, token0, token1, pair, oracle, wallet, setupUniswapPair } = await loadFixture(pairFixture)

    const amount1In = expandTo18Decimals(1)

    await addLiquidity(expandTo18Decimals(5), expandTo18Decimals(10))
    const { priceInfo } = await setupUniswapPair(2)

    const amount0Out = await oracle.getSwapAmount0Out(await pair.swapFee(), amount1In, priceInfo)

    const balance0Before = await token0.balanceOf(wallet.address)
    await token1.transfer(pair.address, amount1In, overrides)
    await pair.swap(amount0Out, 0, wallet.address, priceInfo, overrides)

    const balance0After = await token0.balanceOf(wallet.address)
    expect(balance0After.sub(balance0Before)).to.eq(amount0Out)
  })

  it('returns correct values', async () => {
    const { addLiquidity, token1, pair, oracle, wallet, getState, setupUniswapPair } = await loadFixture(pairFixture)
    const { priceInfo } = await setupUniswapPair('379.55')
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(2137))

    const inputAmount = expandTo18Decimals(100)
    const expectedOutputAmount = expandTo18Decimals('0.262679488868396785')

    expect(await oracle.getSwapAmount0Out(await pair.swapFee(), inputAmount, priceInfo)).to.eq(expectedOutputAmount)
    const before = await getState()
    expect(before.reserves[0]).to.eq(expandTo18Decimals(100))
    expect(before.reserves[1]).to.eq(expandTo18Decimals(2137))

    await token1.transfer(pair.address, inputAmount, overrides)
    await pair.swap(expectedOutputAmount, 0, wallet.address, priceInfo, overrides)

    const inputAmount2 = expandTo18Decimals(100)
    const expectedOutputAmount2 = expandTo18Decimals('0.262679488868396785')

    expect(await oracle.getSwapAmount0Out(await pair.swapFee(), inputAmount2, priceInfo)).to.eq(expectedOutputAmount2)

    const after = await getState()
    expect(after.reserves[0]).to.eq(expandTo18Decimals('99.737320511131603215'))
    expect(after.reserves[1]).to.eq(expandTo18Decimals(2236.7))
  })
})
