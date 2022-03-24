import { Wallet } from 'ethers'
import { getOracleWithUniswapFixtureFor } from './getOracleWithUniswapFixtureFor'

export async function oracleWithUniswapFixture([wallet]: Wallet[]) {
  return getOracleWithUniswapFixtureFor(18, 18)([wallet])
}
