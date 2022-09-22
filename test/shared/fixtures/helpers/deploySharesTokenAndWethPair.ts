import { Wallet } from 'ethers'
import { expandTo18Decimals, overrides } from '../../utilities'
import { TwapOracle, TwapFactory, SharesERC20__factory, WETH9__factory } from '../../../../build/types'
import { deployPairForTokens } from './deployPairForTokens'

export async function deploySharesTokenAndWethPair(
  wallet: Wallet,
  oracle: TwapOracle,
  factory: TwapFactory,
  trader: string
) {
  const sharesToken = await new SharesERC20__factory(wallet).deploy(expandTo18Decimals(10_000), overrides)
  const weth = await new WETH9__factory(wallet).deploy(overrides)
  await weth.deposit({ value: expandTo18Decimals(1000) })

  const pair = await deployPairForTokens(wallet, oracle.address, factory, sharesToken, weth, trader)
  return { ...pair, oracle, sharesToken }
}
