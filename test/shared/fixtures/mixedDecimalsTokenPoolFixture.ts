import { Wallet } from 'ethers'

import { factoryFixture } from './factoryFixture'
import { deployPairForTokens } from './helpers'
import { getOracleV3WithUniswapFixtureFor } from './getOracleV3WithUniswapFixtureFor'

export async function mixedDecimalsTokenPoolFixture(wallets: Wallet[]) {
  return getMixedDecimalsTokenPoolFixture(wallets, 8, 18)
}

export async function getMixedDecimalsTokenPoolFixture([wallet]: Wallet[], xDecimals: number, yDecimals: number) {
  const {
    token0,
    token1,
    oracle,
    pool,
    addLiquidity: addLiquidityPool,
    setUniswapPrice,
    setupUniswapPair,
    getEncodedPriceInfo,
  } = await getOracleV3WithUniswapFixtureFor(xDecimals, yDecimals)([wallet])
  const { factory } = await factoryFixture([wallet])

  const pair = await deployPairForTokens(wallet, oracle.address, factory, token0, token1, wallet.address)
  return { ...pair, oracle, pool, addLiquidityPool, setUniswapPrice, setupUniswapPair, getEncodedPriceInfo }
}
