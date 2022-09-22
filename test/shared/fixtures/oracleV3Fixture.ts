import { Wallet } from 'ethers'

import { getOracleV3FixtureFor } from './getOracleV3FixtureFor'

export async function oracleV3Fixture([wallet]: Wallet[]) {
  return getOracleV3FixtureFor(18, 18)([wallet])
}
