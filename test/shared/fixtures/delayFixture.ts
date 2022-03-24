import { Wallet } from 'ethers'
import { getDelayForPriceFixture } from './getDelayForPriceFixture'

export async function delayFixture([wallet]: Wallet[]) {
  return await getDelayForPriceFixture(2)([wallet])
}
