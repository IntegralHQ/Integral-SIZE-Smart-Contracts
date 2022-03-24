import { Wallet } from 'ethers'
import { ERC20__factory } from '../../../build/types'
import { expandTo18Decimals, overrides } from '../utilities'
import { factoryFixture } from './factoryFixture'
import { oracleFixture } from './oracleFixture'

export async function factoryWithOracleAndTokensFixture([wallet]: Wallet[]) {
  const { oracle } = await oracleFixture([wallet])
  const { factory } = await factoryFixture([wallet])
  const token0 = await new ERC20__factory(wallet).deploy(expandTo18Decimals(10000000), overrides)
  const token1 = await new ERC20__factory(wallet).deploy(expandTo18Decimals(10000000), overrides)

  async function getAnotherOracle() {
    const { oracle: otherOracle } = await oracleFixture([wallet])
    return { otherOracle }
  }

  return { oracle, factory, token0, token1, getAnotherOracle }
}
