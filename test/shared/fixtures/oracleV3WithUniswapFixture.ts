import { Wallet } from 'ethers'

import { getOracleV3WithUniswapFixtureFor } from './getOracleV3WithUniswapFixtureFor'

export async function oracleV3WithUniswapFixture([wallet]: Wallet[]) {
  return getOracleV3WithUniswapFixtureFor(18, 18)([wallet])
}
