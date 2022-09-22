import { Wallet } from 'ethers'
import { OrderIdTest__factory } from '../../../build/types'
import { getMixedDecimalsTokenPairFixture } from './mixedDecimalsTokenPairFixture'
import { deployDelayAndWeth, setTokenTransferCosts } from './helpers'
import { overrides } from '../utilities'

export async function delayWithMixedDecimalsPairFixture(wallets: Wallet[]) {
  return getDelayWithMixedDecimalsPairFixture(wallets, 8, 18)
}

export function getDelayWithMixedDecimalsPairFixtureFor(xDecimals: number, yDecimals: number) {
  return async function (wallets: Wallet[]) {
    return getDelayWithMixedDecimalsPairFixture(wallets, xDecimals, yDecimals)
  }
}

async function getDelayWithMixedDecimalsPairFixture([wallet]: Wallet[], xDecimals: number, yDecimals: number) {
  const pair = await getMixedDecimalsTokenPairFixture([wallet], xDecimals, yDecimals)

  const { delay, token, wethPair, addLiquidityETH, weth, orders, libraries } = await deployDelayAndWeth(
    wallet,
    pair.oracle,
    pair.factory
  )

  await pair.factory.setTrader(pair.token0.address, pair.token1.address, delay.address, overrides)

  const orderIdTest = await new OrderIdTest__factory(wallet).deploy(delay.address, overrides)
  await pair.setupUniswapPair(2)
  await setTokenTransferCosts(delay, [pair.token0, pair.token1, token, weth])

  return { delay, orderIdTest, orders, weth, token, wethPair, addLiquidityETH, ...pair, libraries }
}
