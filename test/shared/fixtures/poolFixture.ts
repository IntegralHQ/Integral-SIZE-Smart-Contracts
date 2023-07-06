import { Wallet } from 'ethers'
import { oracleV3WithUniswapFixture } from './oracleV3WithUniswapFixture'
import { factoryFixture } from './factoryFixture'
import { deployPair } from './helpers'

export async function poolFixture([wallet]: Wallet[]) {
  const {
    oracle,
    pool: uniswapPool,
    getEncodedPriceInfo,
    setupUniswapPool,
    router,
    token0,
    token1,
    createObservations,
  } = await oracleV3WithUniswapFixture([wallet])

  const { factory } = await factoryFixture([wallet])
  const result = await deployPair(wallet, oracle, factory, wallet.address, token0, token1)

  async function getAnotherOracle() {
    const { oracle: otherOracle, pool: uniswapPool } = await oracleV3WithUniswapFixture([wallet])
    return { otherOracle, uniswapPool }
  }

  return { ...result, uniswapPool, getAnotherOracle, setupUniswapPool, getEncodedPriceInfo, router, createObservations }
}
