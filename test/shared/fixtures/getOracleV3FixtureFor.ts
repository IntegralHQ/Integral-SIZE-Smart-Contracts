import { Wallet } from 'ethers'
import { TwapOracleV3Test__factory } from '../../../build/types'
import { overrides } from '../utilities'

export function getOracleV3FixtureFor(xDecimals: number, yDecimals: number) {
  return async function ([wallet]: Wallet[]) {
    const oracle = await new TwapOracleV3Test__factory(wallet).deploy(xDecimals, yDecimals, overrides)
    return { oracle }
  }
}
