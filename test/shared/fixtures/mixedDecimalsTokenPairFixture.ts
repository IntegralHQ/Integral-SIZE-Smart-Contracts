import { Wallet } from 'ethers'

import { factoryFixture } from './factoryFixture'
import { deployPairForTokens } from './helpers'
import { getOracleWithUniswapFixtureFor } from './getOracleWithUniswapFixtureFor'

export async function mixedDecimalsTokenPairFixture([wallet]: Wallet[]) {
  const {
    token0,
    token1,
    oracle,
    pair: uniswapPair,
    setUniswapPrice,
    setupUniswapPair,
  } = await getOracleWithUniswapFixtureFor(8, 18)([wallet])
  const { factory } = await factoryFixture([wallet])

  const pair = await deployPairForTokens(wallet, oracle.address, factory, token0, token1, wallet.address)
  return { ...pair, oracle, uniswapPair, setUniswapPrice, setupUniswapPair }
}
