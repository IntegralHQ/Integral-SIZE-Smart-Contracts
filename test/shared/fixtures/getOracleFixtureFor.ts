import { Wallet } from 'ethers'
import { TwapOracleTest__factory } from '../../../build/types'
import { overrides } from '../utilities'

export function getOracleFixtureFor(xDecimals: number, yDecimals: number) {
  return async function ([wallet]: Wallet[]) {
    const oracle = await new TwapOracleTest__factory(wallet).deploy(xDecimals, yDecimals, overrides)
    return { oracle }
  }
}
