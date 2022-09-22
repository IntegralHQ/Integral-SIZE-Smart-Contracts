import { Wallet } from 'ethers'
import { oracleV3WithUniswapFixture } from './oracleV3WithUniswapFixture'
import { factoryFixture } from './factoryFixture'
import { deployPair } from './helpers'

export async function poolFixture([wallet]: Wallet[]) {
  const { oracle, setUniswapPrice, getEncodedPriceInfo, setupUniswapPair } = await oracleV3WithUniswapFixture([wallet])
  const { factory } = await factoryFixture([wallet])
  const result = await deployPair(wallet, oracle, factory, wallet.address)

  async function getAnotherOracle() {
    const { oracle: otherOracle } = await oracleV3WithUniswapFixture([wallet])
    return { otherOracle }
  }

  return { ...result, setUniswapPrice, getAnotherOracle, setupUniswapPair, getEncodedPriceInfo }
}
