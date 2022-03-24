import { Wallet } from 'ethers'
import { AdjustableERC20__factory, WithdrawHelperTest__factory } from '../../../build/types'
import { expandTo18Decimals, overrides } from '../utilities'

export async function withdrawHelperFixture([wallet]: Wallet[]) {
  const withdrawHelper = await new WithdrawHelperTest__factory(wallet).deploy(overrides)
  const token = await new AdjustableERC20__factory(wallet).deploy(expandTo18Decimals(1000000000000), overrides)
  return { withdrawHelper, token }
}
