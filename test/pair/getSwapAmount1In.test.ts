import { expect } from 'chai'
import { expandTo18Decimals, overrides } from '../shared/utilities'
import { pairFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'

describe('TwapPair.getSwapAmount1In', () => {
  const loadFixture = setupFixtureLoader()

  const testCases = [
    { reserve0: 5, reserve1: 10, price: 2, amount0Out: 1 },
    { reserve0: 10, reserve1: 5, price: 2, amount0Out: 1 },
    { reserve0: 100, reserve1: 5, price: 20, amount0Out: 4 },
    { reserve0: 5, reserve1: 10000, price: 2, amount0Out: 3 },
    { reserve0: 5000, reserve1: 10000, price: 2, amount0Out: 400 },
    { reserve0: 50000, reserve1: 100000, price: 2, amount0Out: 4000 },
    { reserve0: 111111, reserve1: 333333, price: 3, amount0Out: 22222 },
  ]

  for (const { reserve0, reserve1, price, amount0Out } of testCases) {
    it(`reserves=${reserve0}/${reserve1} price=${price} amount0Out=${amount0Out}`, async () => {
      const { addLiquidity, token0, token1, pair, oracle, wallet, setupUniswapPair } = await loadFixture(pairFixture)

      const amountOut = expandTo18Decimals(amount0Out)

      await addLiquidity(expandTo18Decimals(reserve0), expandTo18Decimals(reserve1))
      const { priceInfo } = await setupUniswapPair(price)

      const amount1In = await oracle.testGetSwapAmount1InMax(await pair.swapFee(), amountOut, priceInfo)

      const balance0Before = await token0.balanceOf(wallet.address)
      await token1.transfer(pair.address, amount1In, overrides)
      await pair.swap(amountOut, 0, wallet.address, priceInfo, overrides)

      const balance0After = await token0.balanceOf(wallet.address)
      expect(balance0After.sub(balance0Before)).to.eq(amountOut)
    })
  }

  it('returns correct values', async () => {
    const { addLiquidity, token1, pair, oracle, wallet, getState, setupUniswapPair } = await loadFixture(pairFixture)
    const { priceInfo } = await setupUniswapPair('379.55')
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(2137))

    const outputAmount = expandTo18Decimals(1)
    const expectedInputAmount = expandTo18Decimals('380.692076228686058174')

    expect(await oracle.testGetSwapAmount1InMax(await pair.swapFee(), outputAmount, priceInfo)).to.eq(
      expectedInputAmount
    )
    const before = await getState()
    expect(before.reserves[0]).to.eq(expandTo18Decimals(100))
    expect(before.reserves[1]).to.eq(expandTo18Decimals(2137))

    await token1.transfer(pair.address, expectedInputAmount, overrides)
    await pair.swap(outputAmount, 0, wallet.address, priceInfo, overrides)

    const outputAmount2 = expandTo18Decimals(1)
    const expectedInputAmount2 = expandTo18Decimals('380.692076228686058174')

    expect(await oracle.testGetSwapAmount1InMax(await pair.swapFee(), outputAmount2, priceInfo)).to.eq(
      expectedInputAmount2
    )

    const after = await getState()
    expect(after.reserves[0]).to.eq(expandTo18Decimals('99.000000000000000000'))
    expect(after.reserves[1]).to.eq(expandTo18Decimals('2516.550000000000000000'))
  })
})
