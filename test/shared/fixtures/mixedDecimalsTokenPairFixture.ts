import { Wallet } from 'ethers'

import { factoryFixture } from './factoryFixture'
import { deployPairForTokens } from './helpers'
import { getOracleWithUniswapFixtureFor } from './getOracleWithUniswapFixtureFor'

export async function mixedDecimalsTokenPairFixture(wallets: Wallet[]) {
  return getMixedDecimalsTokenPairFixture(wallets, 8, 18)
}

export async function getMixedDecimalsTokenPairFixture([wallet]: Wallet[], xDecimals: number, yDecimals: number) {
  const {
    token0,
    token1,
    oracle,
    pair: uniswapPair,
    setUniswapPrice,
    setupUniswapPair,
    getEncodedPriceInfo,
  } = await getOracleWithUniswapFixtureFor(xDecimals, yDecimals)([wallet])
  const { factory } = await factoryFixture([wallet])

  const pair = await deployPairForTokens(wallet, oracle.address, factory, token0, token1, wallet.address)
  return { ...pair, oracle, uniswapPair, setUniswapPrice, setupUniswapPair, getEncodedPriceInfo }
}
