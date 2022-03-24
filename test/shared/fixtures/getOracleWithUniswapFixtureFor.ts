import { Wallet } from 'ethers'
import { expandToDecimals, increaseTime, overrides } from '../utilities'
import { getOracleFixtureFor } from './getOracleFixtureFor'
import { getUniswapPairFixtureFor } from './getUniswapPairFixtureFor'

export function getOracleWithUniswapFixtureFor(xDecimals: number, yDecimals: number) {
  return async function ([wallet]: Wallet[]) {
    const { pair, token0, token1, factory, addLiquidity } = await getUniswapPairFixtureFor(
      xDecimals,
      yDecimals
    )([wallet])
    const decimals0 = await token0.decimals()
    const decimals1 = await token1.decimals()
    const { oracle } = await getOracleFixtureFor(decimals0, decimals1)([wallet])

    async function setUniswapPrice(price: number | string) {
      await addLiquidity(expandToDecimals(1, decimals0), expandToDecimals(price, decimals1))
    }

    async function setupUniswapPair(price: number | string) {
      await setUniswapPrice(price)
      if ((await oracle.uniswapPair()) !== pair.address) {
        await oracle.setUniswapPair(pair.address, overrides)
      }
      return { priceInfo: await getEncodedPriceInfo() }
    }

    async function getEncodedPriceInfo() {
      const { priceAccumulator, priceTimestamp } = await oracle.getPriceInfo(overrides)
      await increaseTime(wallet)
      return (await oracle.testEncodePriceInfo(priceAccumulator, priceTimestamp, overrides)).priceInfo
    }

    return {
      token0,
      token1,
      factory,
      pair,
      oracle,
      addLiquidity,
      setUniswapPrice,
      setupUniswapPair,
      getEncodedPriceInfo,
    }
  }
}
