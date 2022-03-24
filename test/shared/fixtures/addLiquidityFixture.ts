import { Wallet } from 'ethers'
import { AddLiquidityTest__factory } from '../../../build/types'
import { pairFixture } from './pairFixture'
import { overrides } from '../utilities'

export async function addLiquidityFixture([wallet]: Wallet[]) {
  const delay = await new AddLiquidityTest__factory(wallet).deploy(overrides)
  const pair = await pairFixture([wallet])
  return { delay, ...pair }
}
