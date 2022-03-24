import { Wallet } from 'ethers'
import { overrides } from '../utilities'
import { TwapFactory__factory } from '../../../build/types'

export async function factoryFixture([wallet]: Wallet[]) {
  const factory = await new TwapFactory__factory(wallet).deploy(overrides)
  return { factory }
}
