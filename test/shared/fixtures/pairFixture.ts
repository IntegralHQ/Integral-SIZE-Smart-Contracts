import { Wallet } from 'ethers'
import { oracleWithUniswapFixture } from './oracleWithUniswapFixture'
import { factoryFixture } from './factoryFixture'
import { deployPair } from './helpers'
import { ERC20__factory } from '../../../build/types'
import { MAX_UINT_256, overrides } from '../utilities'

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

export async function pairWithMaxTokenSupplyFixture([wallet]: Wallet[]) {
  const {
    oracle,
    setUniswapPrice,
    pair: uniswapPair,
    setupUniswapPair,
    getEncodedPriceInfo,
  } = await oracleWithUniswapFixture([wallet])
  const { factory } = await factoryFixture([wallet])
  const token0 = await new ERC20__factory(wallet).deploy(MAX_UINT_256, overrides)
  const token1 = await new ERC20__factory(wallet).deploy(MAX_UINT_256, overrides)
  const result = await deployPair(wallet, oracle, factory, wallet.address, token0, token1)

  async function getAnotherOracle() {
    const { oracle: otherOracle } = await oracleWithUniswapFixture([wallet])
    return { otherOracle }
  }

  return { ...result, oracle, uniswapPair, setUniswapPrice, getAnotherOracle, setupUniswapPair, getEncodedPriceInfo }
}
