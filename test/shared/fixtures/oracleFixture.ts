import { Wallet } from 'ethers'

import { getOracleFixtureFor } from './getOracleFixtureFor'

export async function oracleFixture([wallet]: Wallet[]) {
  return getOracleFixtureFor(18, 18)([wallet])
}
