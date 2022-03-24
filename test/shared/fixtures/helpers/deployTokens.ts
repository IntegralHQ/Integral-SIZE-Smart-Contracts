import { Wallet } from 'ethers'
import { CustomERC20__factory } from '../../../../build/types'
import { expandToDecimals, overrides } from '../../utilities'

export async function deployTokens(xDecimals: number, yDecimals: number, wallet: Wallet) {
  const tokenA = await new CustomERC20__factory(wallet).deploy(
    '',
    '',
    xDecimals,
    expandToDecimals(1000000, xDecimals),
    overrides
  )
  const tokenB = await new CustomERC20__factory(wallet).deploy(
    '',
    '',
    yDecimals,
    expandToDecimals(1000000, yDecimals),
    overrides
  )
  const [token0, token1] =
    tokenA.address.toLowerCase() > tokenB.address.toLowerCase() ? [tokenB, tokenA] : [tokenA, tokenB]
  return { token0, token1 }
}
