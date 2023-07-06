import { Wallet } from 'ethers'
import { oracleFixture } from './oracleFixture'
import { factoryAndTokesFixture } from './factoryAndTokesFixture'

export async function factoryWithOracleAndTokensFixture([wallet]: Wallet[]) {
  const { oracle } = await oracleFixture([wallet])
  async function getAnotherOracle() {
    const { oracle: otherOracle } = await oracleFixture([wallet])
    return { otherOracle }
  }

  return { ...(await factoryAndTokesFixture([wallet])), oracle, getAnotherOracle }
}
