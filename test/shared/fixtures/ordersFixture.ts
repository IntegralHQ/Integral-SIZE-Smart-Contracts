import { Wallet } from 'ethers'
import { overrides } from '../utilities'
import { OrdersTest__factory } from '../../../build/types'
import { deployLibraries } from './helpers'

export async function ordersFixture([wallet]: Wallet[]) {
  const { libraries } = await deployLibraries(wallet)
  const orders = await new OrdersTest__factory(libraries, wallet).deploy(overrides)
  return { orders }
}
