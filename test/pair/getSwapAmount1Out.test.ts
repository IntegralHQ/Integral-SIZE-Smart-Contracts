import { expect } from 'chai'
import { expandTo18Decimals, overrides } from '../shared/utilities'
import { pairFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'

describe('TwapPair.getSwapAmount1Out', () => {
  const loadFixture = setupFixtureLoader()

  it('returns the number of token1 swapped for token0', async () => {
    const { addLiquidity, token0, token1, pair, oracle, wallet, setupUniswapPair } = await loadFixture(pairFixture)

    const amount0In = expandTo18Decimals(2)

    await addLiquidity(expandTo18Decimals(5), expandTo18Decimals(10))
    const { priceInfo } = await setupUniswapPair(2)

    const amount1Out = await oracle.getSwapAmount1Out(await pair.swapFee(), amount0In, priceInfo)

    const balance1Before = await token1.balanceOf(wallet.address)
    await token0.transfer(pair.address, amount0In, overrides)
    await pair.swap(0, amount1Out, wallet.address, priceInfo, overrides)

    const balance1After = await token1.balanceOf(wallet.address)
    expect(balance1After.sub(balance1Before)).to.eq(amount1Out)
  })

  it('returns correct values', async () => {
    const { addLiquidity, token0, pair, oracle, wallet, getState, setupUniswapPair } = await loadFixture(pairFixture)
    const { priceInfo } = await setupUniswapPair('379.55')
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(2137))

    const inputAmount = expandTo18Decimals(1)
    const expectedOutputAmount = expandTo18Decimals('378.411349999999999999')

    expect(await oracle.getSwapAmount1Out(await pair.swapFee(), inputAmount, priceInfo)).to.eq(expectedOutputAmount)
    const before = await getState()
    expect(before.reserves[0]).to.eq(expandTo18Decimals(100))
    expect(before.reserves[1]).to.eq(expandTo18Decimals(2137))

    await token0.transfer(pair.address, inputAmount, overrides)
    await pair.swap(0, expectedOutputAmount, wallet.address, priceInfo, overrides)

    const inputAmount2 = expandTo18Decimals(1)
    const expectedOutputAmount2 = expandTo18Decimals('378.411349999999999999')

    expect(await oracle.getSwapAmount1Out(await pair.swapFee(), inputAmount2, priceInfo)).to.eq(expectedOutputAmount2)

    const after = await getState()
    expect(after.reserves[0]).to.eq(expandTo18Decimals(100.997))
    expect(after.reserves[1]).to.eq(expandTo18Decimals('1758.588650000000000001'))
  })
})
