import { expect } from 'chai'
import { getOracleV3WithUniswapFixtureFor } from '../shared/fixtures/getOracleV3WithUniswapFixtureFor'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, expandToDecimals, increaseTime, overrides } from '../shared/utilities'
import {
  FeeAmount,
  getPricefromSqrtRatioX96,
  getSqrtPriceX96,
  getSqrtRatioAtTick,
  getSurroundingPriceAtTick,
  getTickAtSqrtRatio,
} from '../shared/uniswapV3Utilities'
import { BigNumber } from 'ethers'

describe('TwapOracleV3.getAveragePrice', () => {
  const loadFixture = setupFixtureLoader()

  const configurations = [
    [1000, 20, 18, 18],
    [1000, 20, 10, 10],
    [1000, 20, 18, 10],
    [1000, 20, 10, 18],
  ]

  for (const [a, b, xDecimals, yDecimals] of configurations) {
    const fixture = getOracleV3WithUniswapFixtureFor(xDecimals, yDecimals)
    const permutations = [
      [a, b],
      [b, a],
    ]
    for (const [xSupply, ySupply] of permutations) {
      it(`price for ${xSupply}e${xDecimals}, ${ySupply}e${yDecimals}`, async () => {
        const { pool, setUniswapPrice, createObservations, oracle } = await loadFixture(fixture)

        await setUniswapPrice(expandToDecimals(xSupply, xDecimals), expandToDecimals(ySupply, yDecimals))
        await createObservations()

        await oracle.setUniswapPair(pool.address, overrides)
        await oracle.setTwapInterval(1)

        const price = await oracle.getAveragePrice(0, 0, overrides)

        const expectedSqrtPriceX96 = getSqrtPriceX96(
          expandToDecimals(xSupply, xDecimals),
          expandToDecimals(ySupply, yDecimals)
        )
        const expectedTick = getTickAtSqrtRatio(expectedSqrtPriceX96)
        const tickSpacing = await pool.tickSpacing()
        const [expectedLowPrice, expectedHighPrice] = getSurroundingPriceAtTick(
          xDecimals,
          yDecimals,
          expectedTick,
          tickSpacing
        )

        // This can never be exact because the price rounds to the nearest tick.
        expect(price).to.be.gt(expectedLowPrice)
        expect(price).to.be.lte(expectedHighPrice)
      })
    }

    it('change after swap', async () => {
      const { pool, setUniswapPrice, createObservations, addLiquidity, oracle, wallet, token0, token1, router } =
        await loadFixture(fixture)

      const xSupply = 100
      const ySupply = 50_000
      await setUniswapPrice(expandToDecimals(xSupply, xDecimals), expandToDecimals(ySupply, yDecimals))
      await createObservations()

      await addLiquidity(expandToDecimals(xSupply, xDecimals), expandToDecimals(ySupply, yDecimals))

      await oracle.setUniswapPair(pool.address, overrides)
      await oracle.setTwapInterval(1)

      await increaseTime(wallet)

      const price = await oracle.getAveragePrice(0, 0, overrides)

      await increaseTime(wallet)

      await router.swapOnUniswap({
        recipient: wallet.address,
        amountIn: expandToDecimals(10_000, yDecimals),
        amountOutMinimum: 0,
        fee: FeeAmount.LOW,
        tokenIn: token1,
        tokenOut: token0,
      })

      await increaseTime(wallet)

      const price2 = await oracle.getAveragePrice(0, 0, overrides)
      expect(price).to.be.lt(price2)
    })
  }

  it('reverts when no time elapsed', async () => {
    const fixture = getOracleV3WithUniswapFixtureFor(18, 18)
    const { pool, setUniswapPrice, addLiquidity, oracle } = await loadFixture(fixture)
    await setUniswapPrice(expandTo18Decimals(100), expandTo18Decimals(100))
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await oracle.setUniswapPair(pool.address)
    await expect(oracle.testGetAveragePriceForNoTimeElapsed()).to.be.reverted
  })

  it('average price overflows uint128', async () => {
    const xDecimals = 18
    const yDecimals = 18
    const { pool, setUniswapPrice, addLiquidity, oracle } = await loadFixture(
      getOracleV3WithUniswapFixtureFor(xDecimals, yDecimals)
    )
    const MaxUint128Sqrt = BigNumber.from(2).pow(128).sub(1)
    const MaxUint128Tick = getTickAtSqrtRatio(MaxUint128Sqrt)
    const MaxUint128Price = getPricefromSqrtRatioX96(xDecimals, yDecimals, getSqrtRatioAtTick(MaxUint128Tick))
      .mul(10000)
      .div(9999)

    await setUniswapPrice(expandToDecimals(1, xDecimals), MaxUint128Price)
    await addLiquidity(expandToDecimals(1, xDecimals), expandToDecimals(1, yDecimals))
    await oracle.setUniswapPair(pool.address, overrides)
    await oracle.setTwapInterval(1, overrides)

    const averagePrice = await oracle.getAveragePrice(0, 0, overrides)
    const expectedSqrtPriceX96 = getSqrtPriceX96(expandToDecimals(1, xDecimals), MaxUint128Price)
    const expectedTick = getTickAtSqrtRatio(expectedSqrtPriceX96)
    const tickSpacing = await pool.tickSpacing()
    const [expectedLowPrice, expectedHighPrice] = getSurroundingPriceAtTick(
      xDecimals,
      yDecimals,
      expectedTick,
      tickSpacing
    )
    expect(averagePrice).to.be.gt(expectedLowPrice)
    expect(averagePrice).to.be.lte(expectedHighPrice)
  })
})
