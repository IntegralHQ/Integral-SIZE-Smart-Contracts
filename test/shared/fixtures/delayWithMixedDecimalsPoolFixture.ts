import { Wallet } from 'ethers'
import { OrderIdTest__factory } from '../../../build/types'
import { getMixedDecimalsTokenPoolFixture } from './mixedDecimalsTokenPoolFixture'
import { deployDelayAndWeth, setTokenTransferCosts } from './helpers'
import { overrides } from '../utilities'

export async function delayWithMixedDecimalsPoolFixture(wallets: Wallet[]) {
  return getDelayWithMixedDecimalsPoolFixture(wallets, 8, 18)
}

export function getDelayWithMixedDecimalsPoolFixtureFor(xDecimals: number, yDecimals: number) {
  return async function (wallets: Wallet[]) {
    return getDelayWithMixedDecimalsPoolFixture(wallets, xDecimals, yDecimals)
  }
}

async function getDelayWithMixedDecimalsPoolFixture([wallet]: Wallet[], xDecimals: number, yDecimals: number) {
  const pool = await getMixedDecimalsTokenPoolFixture([wallet], xDecimals, yDecimals)

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
