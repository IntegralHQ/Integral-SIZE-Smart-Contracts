import { Wallet } from 'ethers'
import { oracleV3Fixture } from './oracleV3Fixture'
import { factoryAndTokesFixture } from './factoryAndTokesFixture'

export async function factoryWithOracleV3AndTokensFixture([wallet]: Wallet[]) {
  const { oracle } = await oracleV3Fixture([wallet])
  async function getAnotherOracle() {
    const { oracle: otherOracle } = await oracleV3Fixture([wallet])
    return { otherOracle }
  }

  return { ...(await factoryAndTokesFixture([wallet])), oracle, getAnotherOracle }
}
