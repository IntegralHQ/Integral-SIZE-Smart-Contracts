import { BigNumber, Wallet } from 'ethers'
import { expandToDecimals, increaseTime, overrides } from '../utilities'
import { getOracleV3FixtureFor } from './getOracleV3FixtureFor'
import { getUniswapV3PairFixtureFor } from './getUniswapV3PairFixtureFor'

export function getOracleV3WithUniswapFixtureFor(xDecimals: number, yDecimals: number) {
  return async function ([wallet]: Wallet[]) {
    const { pool, token0, token1, factory, initializePrice, addLiquidity, router } = await getUniswapV3PairFixtureFor(
      xDecimals,
      yDecimals
    )([wallet])
    const decimals0 = await token0.decimals()
    const decimals1 = await token1.decimals()
    const { oracle } = await getOracleV3FixtureFor(decimals0, decimals1)([wallet])

    async function setUniswapPrice(token0Amount: BigNumber, token1Amount: BigNumber) {
      await initializePrice(token0Amount, token1Amount)
    }

    async function setupUniswapPair(token0Amount: BigNumber, token1Amount: BigNumber) {
      await setUniswapPrice(token0Amount, token1Amount)
      await addLiquidity(token0Amount, token1Amount)
      if ((await oracle.uniswapPair()) !== pool.address) {
        await oracle.setUniswapPair(pool.address, overrides)
      }
      await oracle.setTwapInterval(1)
      return { priceInfo: await getEncodedPriceInfo() }
    }

    async function getEncodedPriceInfo() {
      const { priceAccumulator, priceTimestamp } = await oracle.getPriceInfo(overrides)
      await increaseTime(wallet)
      return (await oracle.testEncodePriceInfo(priceAccumulator, priceTimestamp, overrides)).priceInfo
    }

    async function createObservations() {
      for (let minutes = 30; minutes > 0; minutes--) {
        await pool.increaseObservationCardinalityNext(60 + minutes, overrides)
      }
      await addLiquidity(expandToDecimals(1000, decimals0), expandToDecimals(1000, decimals1))
      await addLiquidity(expandToDecimals(500, decimals0), expandToDecimals(500, decimals1))
      await addLiquidity(expandToDecimals(400, decimals0), expandToDecimals(700, decimals1))
      await addLiquidity(expandToDecimals(1200, decimals0), expandToDecimals(800, decimals1))
    }

    return {
      token0,
      token1,
      factory,
      pool,
      oracle,
      router,
      setUniswapPrice,
      setupUniswapPair,
      addLiquidity,
      createObservations,
      getEncodedPriceInfo,
    }
  }
}
