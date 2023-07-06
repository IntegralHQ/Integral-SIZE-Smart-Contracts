import { Wallet } from 'ethers'
import { expandTo18Decimals, expandToDecimals, overrides } from '../../utilities'
import { CustomERC20__factory, ERC20__factory, WETH9__factory } from '../../../../build/types'

export async function deployTokenAndWeth(wallet: Wallet) {
  const weth = await new WETH9__factory(wallet).deploy(overrides)
  const token = await new ERC20__factory(wallet).deploy(expandTo18Decimals(10000), overrides)
  const token6decimals = await new CustomERC20__factory(wallet).deploy(
    'Token',
    'TKN',
    6,
    expandToDecimals(10000000, 6),
    overrides
  )
  return { token, token6decimals, weth }
}
