import { expect } from 'chai'

import { expandTo18Decimals, overrides } from '../shared/utilities'
import { pairFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'

describe('TwapPair.getSwapAmount0In', () => {
  const loadFixture = setupFixtureLoader()

  const testCases = [
    { reserve0: 5, reserve1: 10, price: 2, amount1Out: 1 },
    { reserve0: 10, reserve1: 5, price: 2, amount1Out: 1 },
    { reserve0: 100, reserve1: 5, price: 20, amount1Out: 4 },
    { reserve0: 5, reserve1: 10000, price: 2, amount1Out: 3 },
    { reserve0: 5000, reserve1: 10000, price: 2, amount1Out: 400 },
    { reserve0: 50000, reserve1: 100000, price: 2, amount1Out: 4000 },
    { reserve0: 111111, reserve1: 333333, price: 3, amount1Out: 222222 },
  ]

  for (const { reserve0, reserve1, price, amount1Out } of testCases) {
    it(`reserves=${reserve0}/${reserve1} price=${price} amount1Out=${amount1Out}`, async () => {
      const { addLiquidity, setupUniswapPair, token0, token1, pair, oracle, wallet } = await loadFixture(pairFixture)

      const amountOut = expandTo18Decimals(amount1Out)

      await addLiquidity(expandTo18Decimals(reserve0), expandTo18Decimals(reserve1))
      const { priceInfo } = await setupUniswapPair(1)

      const amount0In = await oracle.testGetSwapAmount0InMax(await pair.swapFee(), amountOut, priceInfo)

      const balance1Before = await token1.balanceOf(wallet.address)
      await token0.transfer(pair.address, amount0In, overrides)
      await pair.swap(0, amountOut, wallet.address, priceInfo, overrides)

      const balance1After = await token1.balanceOf(wallet.address)
      expect(balance1After.sub(balance1Before)).to.eq(amountOut)
    })
  }

  it('returns correct values', async () => {
    const { addLiquidity, setupUniswapPair, token0, pair, oracle, wallet, getState } = await loadFixture(pairFixture)
    const { priceInfo } = await setupUniswapPair('379.55')
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(2137))

    const outputAmount = expandTo18Decimals(100)
    const expectedInputAmount = expandTo18Decimals('0.264262686623960936')

    expect(await oracle.testGetSwapAmount0InMax(await pair.swapFee(), outputAmount, priceInfo)).to.eq(
      expectedInputAmount
    )
    const before = await getState()
    expect(before.reserves[0]).to.eq(expandTo18Decimals(100))
    expect(before.reserves[1]).to.eq(expandTo18Decimals(2137))

    await token0.transfer(pair.address, expectedInputAmount, overrides)
    await pair.swap(0, outputAmount, wallet.address, priceInfo, overrides)

    const outputAmount2 = expandTo18Decimals(100)
    const expectedInputAmount2 = expandTo18Decimals('0.264262686623960936')
    expect(await oracle.testGetSwapAmount0InMax(await pair.swapFee(), outputAmount2, priceInfo)).to.eq(
      expectedInputAmount2
    )

    const after = await getState()
    expect(after.reserves[0]).to.eq(expandTo18Decimals('100.263469898564089054'))
    expect(after.reserves[1]).to.eq(expandTo18Decimals('2036.999999999999999555'))
  })
})
