import { Wallet } from 'ethers'
import { OrderIdTest__factory } from '../../../build/types'
import { overrides } from '../utilities'
import { deployDelayAndWeth, setTokenTransferCosts } from './helpers'
import { sharesPairFixture } from './sharesPairFixture'

export function getSharesTokenDelayFixture(price: number) {
  return async function ([wallet]: Wallet[]) {
    const pair = await sharesPairFixture([wallet])
    await pair.setupUniswapPair(price)

    const { delay, token, wethPair, addLiquidityETH, weth, orders, libraries } = await deployDelayAndWeth(
      wallet,
      pair.oracle,
      pair.factory
    )

    await pair.factory.setTrader(pair.token0.address, pair.token1.address, delay.address, overrides)

    const orderIdTest = await new OrderIdTest__factory(wallet).deploy(delay.address, overrides)
    await setTokenTransferCosts(delay, [pair.token0, pair.token1, token, weth])

    return { delay, orderIdTest, orders, weth, token, wethPair, addLiquidityETH, ...pair, libraries }
  }
}
