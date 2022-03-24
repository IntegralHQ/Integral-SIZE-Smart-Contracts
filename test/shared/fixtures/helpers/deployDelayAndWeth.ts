import { Wallet, BigNumber } from 'ethers'
import { TwapOracle, TwapFactory } from '../../../../build/types'
import { overrides } from '../../utilities'
import { deployPairForTokens } from './deployPairForTokens'
import { deployTokenAndWeth } from './deployTokenAndWeth'
import { deployDelay } from './deployDelay'

export async function deployDelayAndWeth(wallet: Wallet, oracle: TwapOracle, factory: TwapFactory) {
  const { token, weth } = await deployTokenAndWeth(wallet)
  const { delay, ...libraries } = await deployDelay(wallet, factory, weth)
  const { pair, addLiquidity, token0, token1 } = await deployPairForTokens(
    wallet,
    oracle.address,
    factory,
    weth,
    token,
    delay.address
  )

  async function addLiquidityETH(tokenAmount: BigNumber, wethAmount: BigNumber) {
    await weth.deposit({ value: wethAmount, ...overrides })
    await addLiquidity(
      token0.address == weth.address ? wethAmount : tokenAmount,
      token1.address == weth.address ? wethAmount : tokenAmount
    )
  }

  return { token, wethPair: pair, addLiquidityETH, weth, delay, ...libraries }
}
