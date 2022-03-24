import { Wallet } from 'ethers'
import { oracleWithUniswapFixture } from './oracleWithUniswapFixture'
import { factoryFixture } from './factoryFixture'
import { deployPair } from './helpers'

export async function pairFixture([wallet]: Wallet[]) {
  const {
    oracle,
    setUniswapPrice,
    pair: uniswapPair,
    setupUniswapPair,
    getEncodedPriceInfo,
  } = await oracleWithUniswapFixture([wallet])
  const { factory } = await factoryFixture([wallet])
  const result = await deployPair(wallet, oracle, factory, wallet.address)

  async function getAnotherOracle() {
    const { oracle: otherOracle } = await oracleWithUniswapFixture([wallet])
    return { otherOracle }
  }

  return { ...result, oracle, uniswapPair, setUniswapPrice, getAnotherOracle, setupUniswapPair, getEncodedPriceInfo }
}
