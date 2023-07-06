import { Wallet } from 'ethers'
import { poolFixture } from '.'
import { OrderIdTest__factory } from '../../../build/types'
import { expandToDecimals, overrides } from '../utilities'
import { deployDelayAndWeth, setTokenTransferCosts } from './helpers'

export function getDelayForPriceOracleV3Fixture(amount0: number, amount1: number) {
  return async function ([wallet]: Wallet[]) {
    const pool = await poolFixture([wallet])
    const token0Amount = expandToDecimals(amount0, await pool.token0.decimals())
    const token1Amount = expandToDecimals(amount1, await pool.token1.decimals())
    await pool.setupUniswapPool(token0Amount, token1Amount)

    const {
      delay,
      limitOrder,
      token,
      token6decimals,
      wethPair,
      wethPair6decimals,
      addLiquidityETH,
      weth,
      orders,
      libraries,
      setupUniswapPool6decimals,
      getState6decimals,
      oracle6decimals,
    } = await deployDelayAndWeth(wallet, pool.oracle, pool.factory)
    //set additional oracle with real usdc-weth price
    const [amnt0, amnt1] = (await oracle6decimals.xDecimals()) == 6 ? [1243, 1] : [1, 1243]
    await setupUniswapPool6decimals(
      expandToDecimals(amnt0, await oracle6decimals.xDecimals()),
      expandToDecimals(amnt1, await oracle6decimals.yDecimals())
    )

    await pool.factory.setTrader(pool.token0.address, pool.token1.address, delay.address, overrides)

    const orderIdTest = await new OrderIdTest__factory(wallet).deploy(delay.address, overrides)
    await setTokenTransferCosts(delay, [pool.token0, pool.token1, token, weth, token6decimals])

    return {
      delay,
      limitOrder,
      orderIdTest,
      orders,
      weth,
      token,
      token6decimals,
      wethPair,
      wethPair6decimals,
      addLiquidityETH,
      getState6decimals,
      ...pool,
      libraries,
    }
  }
}
