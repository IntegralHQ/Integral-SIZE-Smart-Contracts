import { Wallet } from 'ethers'
import { pairFixture, pairWithMaxTokenSupplyFixture } from '.'
import { OrderIdTest__factory } from '../../../build/types'
import { overrides } from '../utilities'
import { deployDelayAndWeth, setTokenTransferCosts } from './helpers'

export function getDelayForPriceFixture(price: number) {
  return async function ([wallet]: Wallet[]) {
    const pair = await pairFixture([wallet])
    await pair.setupUniswapPair(price)

    const { delay, limitOrder, token, wethPair, addLiquidityETH, weth, orders, libraries } = await deployDelayAndWeth(
      wallet,
      pair.oracle,
      pair.factory
    )

    await pair.factory.setTrader(pair.token0.address, pair.token1.address, delay.address, overrides)

    const orderIdTest = await new OrderIdTest__factory(wallet).deploy(delay.address, overrides)
    await setTokenTransferCosts(delay, [pair.token0, pair.token1, token, weth])

    return { delay, limitOrder, orderIdTest, orders, weth, token, wethPair, addLiquidityETH, ...pair, libraries }
  }
}

export function getDelayForPriceWithMaxTokenSupplyFixture(price: number) {
  return async function ([wallet]: Wallet[]) {
    const pair = await pairWithMaxTokenSupplyFixture([wallet])
    await pair.setupUniswapPair(price)

    const { delay, limitOrder, token, wethPair, addLiquidityETH, weth, orders, libraries } = await deployDelayAndWeth(
      wallet,
      pair.oracle,
      pair.factory
    )

    await pair.factory.setTrader(pair.token0.address, pair.token1.address, delay.address, overrides)

    const orderIdTest = await new OrderIdTest__factory(wallet).deploy(delay.address, overrides)
    await setTokenTransferCosts(delay, [pair.token0, pair.token1, token, weth])

    return { delay, limitOrder, orderIdTest, orders, weth, token, wethPair, addLiquidityETH, ...pair, libraries }
  }
}
