import { Wallet, BigNumber } from 'ethers'
import { TwapOracle, TwapFactory } from '../../../../build/types'
import { overrides } from '../../utilities'
import { deployPairForTokens } from './deployPairForTokens'
import { deployTokenAndWeth } from './deployTokenAndWeth'
import { deployDelay } from './deployDelay'
import { getOracleV3WithUniswapFixtureFor } from '../getOracleV3WithUniswapFixtureFor'

export async function deployDelayAndWeth(wallet: Wallet, oracle: TwapOracle, factory: TwapFactory) {
  const { token, token6decimals, weth } = await deployTokenAndWeth(wallet)
  const { delay, ...libraries } = await deployDelay(wallet, factory, weth)
  const { pair, addLiquidity, token0, token1 } = await deployPairForTokens(
    wallet,
    oracle.address,
    factory,
    weth,
    token,
    delay.address
  )
  const { oracle: oracle6decimals, setupUniswapPool: setupUniswapPool6decimals } =
    await getOracleV3WithUniswapFixtureFor(await token6decimals.decimals(), await weth.decimals())([wallet])

  const { pair: wethPair6decimals, getState: getState6decimals } = await deployPairForTokens(
    wallet,
    oracle6decimals.address,
    factory,
    token6decimals,
    weth,
    delay.address
  )

  async function addLiquidityETH(tokenAmount: BigNumber, wethAmount: BigNumber) {
    await weth.deposit({ value: wethAmount.mul(2), ...overrides })
    await addLiquidity(
      token0.address == weth.address ? wethAmount : tokenAmount,
      token1.address == weth.address ? wethAmount : tokenAmount
    )
  }

  return {
    token,
    token6decimals,
    wethPair: pair,
    wethPair6decimals,
    addLiquidityETH,
    weth,
    delay,
    oracle6decimals,
    setupUniswapPool6decimals,
    getState6decimals,
    ...libraries,
  }
}
