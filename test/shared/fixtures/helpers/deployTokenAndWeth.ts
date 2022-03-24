import { Wallet } from 'ethers'
import { expandTo18Decimals, overrides } from '../../utilities'
import { ERC20__factory, WETH9__factory } from '../../../../build/types'

export async function deployTokenAndWeth(wallet: Wallet) {
  const weth = await new WETH9__factory(wallet).deploy(overrides)
  const token = await new ERC20__factory(wallet).deploy(expandTo18Decimals(10000), overrides)
  return { token, weth }
}
