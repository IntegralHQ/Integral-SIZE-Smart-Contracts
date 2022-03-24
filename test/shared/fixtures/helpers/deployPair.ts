import { Wallet } from 'ethers'
import { expandTo18Decimals, overrides } from '../../utilities'
import { ERC20__factory, TwapOracle, TwapFactory } from '../../../../build/types'
import { deployPairForTokens } from './deployPairForTokens'

export async function deployPair(wallet: Wallet, oracle: TwapOracle, factory: TwapFactory, trader: string) {
  const tokenA = await new ERC20__factory(wallet).deploy(expandTo18Decimals(1000000000000), overrides)
  const tokenB = await new ERC20__factory(wallet).deploy(expandTo18Decimals(1000000000000), overrides)

  const pair = await deployPairForTokens(wallet, oracle.address, factory, tokenA, tokenB, trader)
  return { ...pair, oracle }
}
