import { BigNumber, providers, Wallet } from 'ethers'
import { getOracleWithUniswapFixtureFor } from '.'
import { IERC20, TwapOracle, IUniswapV2Pair } from '../../../build/types'
import { factoryFixture } from './factoryFixture'
import { expandTo18Decimals, overrides } from '../utilities'
import { oracleFixture } from './oracleFixture'
import { deployDelayAndWeth, deployPairForTokens, setTokenTransferCosts } from './helpers'

export type UniswapPair = {
  token0: IERC20
  oracle: TwapOracle
  pair: IUniswapV2Pair
  addLiquidity: (token0Amount: BigNumber, token1Amount: BigNumber) => void
}

export async function uniswapFixture([wallet]: Wallet[]) {
  const { factory } = await factoryFixture([wallet])
  const { oracle } = await oracleFixture([wallet])
  const { delay } = await deployDelayAndWeth(wallet, oracle, factory)

  const uniswapPair01 = await getOracleWithUniswapFixtureFor(18, 18)([wallet])
  await setupOracleWithUniswap(100, 400, 120, uniswapPair01)
  const {
    token0,
    token1,
    pair: pair01,
  } = await deployPairForTokens(
    wallet,
    uniswapPair01.oracle.address,
    factory,
    uniswapPair01.token0,
    uniswapPair01.token1,
    delay.address
  )

  const uniswapPair23 = await getOracleWithUniswapFixtureFor(18, 18)([wallet])
  await setupOracleWithUniswap(500, 200, 30, uniswapPair23)
  const {
    token0: token2,
    token1: token3,
    pair: pair23,
  } = await deployPairForTokens(
    wallet,
    uniswapPair23.oracle.address,
    factory,
    uniswapPair23.token0,
    uniswapPair23.token1,
    delay.address
  )

  await setTokenTransferCosts(delay, [token0, token1, token2, token3])

  async function setupOracleWithUniswap(
    initialLiquidity0: number,
    initialLiquidity1: number,
    initialSwap: number,
    uniswapPair: UniswapPair
  ) {
    const { token0, oracle, pair, addLiquidity } = uniswapPair

    await addLiquidity(expandTo18Decimals(initialLiquidity0), expandTo18Decimals(initialLiquidity1))
    await (wallet.provider as providers.Web3Provider).send('evm_increaseTime', [1])
    await pair.sync(overrides)

    await oracle.setUniswapPair(pair.address, overrides)
    await swapOnUniswapPair(uniswapPair.pair, initialSwap, token0)
  }

  async function swapOnUniswapPair(pair: IUniswapV2Pair, swap: number, tokenIn: IERC20) {
    const { reserve0, reserve1 } = await pair.getReserves()
    const [numerator, denominator] =
      tokenIn.address === (await pair.token0()) ? [reserve0, reserve1] : [reserve1, reserve0]
    const requiredAmountToSwap = expandTo18Decimals(swap).mul(numerator).div(denominator).mul('15').div('10')
    await tokenIn.transfer(pair.address, requiredAmountToSwap, overrides)

    const [token0Amount, token1Amount] = tokenIn.address === (await pair.token0()) ? [0, swap] : [swap, 0]
    await pair.swap(expandTo18Decimals(token0Amount), expandTo18Decimals(token1Amount), wallet.address, '0x', overrides)
  }

  return {
    wallet,
    delay,
    token0,
    token1,
    pair01,
    token2,
    token3,
    pair23,
    uniswapPair01: uniswapPair01.pair,
    uniswapPair23: uniswapPair23.pair,
    swapOnUniswapPair,
    factory,
    oracle01: uniswapPair01.oracle,
  }
}
