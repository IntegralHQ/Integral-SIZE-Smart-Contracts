import { Wallet } from 'ethers'
import { overrides } from '../utilities'
import { OrdersTest__factory } from '../../../build/types'

export async function ordersFixture([wallet]: Wallet[]) {
  const orders = await new OrdersTest__factory(wallet).deploy(overrides)
  return { orders }
}
