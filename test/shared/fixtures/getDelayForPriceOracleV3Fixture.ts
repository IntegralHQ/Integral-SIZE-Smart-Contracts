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
    await pool.setupUniswapPair(token0Amount, token1Amount)

    const { delay, token, wethPair, addLiquidityETH, weth, orders, libraries } = await deployDelayAndWeth(
      wallet,
      pool.oracle,
      pool.factory
    )

    await pool.factory.setTrader(pool.token0.address, pool.token1.address, delay.address, overrides)

    const orderIdTest = await new OrderIdTest__factory(wallet).deploy(delay.address, overrides)
    await setTokenTransferCosts(delay, [pool.token0, pool.token1, token, weth])

    return { delay, orderIdTest, orders, weth, token, wethPair, addLiquidityETH, ...pool, libraries }
  }
}
