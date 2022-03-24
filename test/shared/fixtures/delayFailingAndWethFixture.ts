import { Wallet } from '@ethersproject/wallet'
import { BigNumber } from 'ethers'
import { FailingERC20__factory } from '../../../build/types'
import { expandTo18Decimals, overrides } from '../utilities'
import { delayFixture } from './delayFixture'
import { deployPairForTokens } from './helpers'

export async function delayFailingAndWethFixture([wallet]: Wallet[]) {
  const { oracle, factory, weth, delay } = await delayFixture([wallet])
  const failingToken = await new FailingERC20__factory(wallet).deploy(expandTo18Decimals(100000), overrides)

  const {
    pair: wethPair,
    addLiquidity,
    token0,
    token1,
  } = await deployPairForTokens(wallet, oracle.address, factory, failingToken, weth, delay.address)

  async function addLiquidityETH(tokenAmount: BigNumber, wethAmount: BigNumber) {
    await weth.deposit({ value: wethAmount, ...overrides })
    await addLiquidity(
      token0.address == weth.address ? wethAmount : tokenAmount,
      token1.address == weth.address ? wethAmount : tokenAmount
    )
  }

  return { delay, weth, failingToken, wethPair, addLiquidityETH }
}
