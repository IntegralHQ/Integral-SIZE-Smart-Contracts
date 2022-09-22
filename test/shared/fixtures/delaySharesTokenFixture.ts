import { Wallet } from 'ethers'
import { getSharesTokenDelayFixture } from './getSharesTokenDelayFixture'

export async function delaySharesTokenFixture([wallet]: Wallet[]) {
  return await getSharesTokenDelayFixture(2)([wallet])
}
