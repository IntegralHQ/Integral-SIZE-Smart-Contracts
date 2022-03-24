import { expect } from 'chai'
import { IERC20, TwapPair } from '../build/types'
import { uniswapFixture } from './shared/fixtures/uniswapFixture'
import { buy as buyOrder, deposit as depositOrder, sell as sellOrder, withdraw as withdrawOrder } from './shared/orders'
import { setupFixtureLoader } from './shared/setup'
import {
  DELAY,
  expandTo18Decimals,
  getEthRefund,
  getEvents,
  getGasSpent,
  increaseTime,
  overrides,
} from './shared/utilities'

describe('integrationV2', () => {
  const loadFixture = setupFixtureLoader()

  it('makes different transactions on pairs', async () => {
    const {
      wallet,
      delay,
      token0,
      token1,
      token2,
      token3,
      pair01,
      pair23,
      uniswapPair01,
      uniswapPair23,
      swapOnUniswapPair,
    } = await loadFixture(uniswapFixture)

    async function deposit(tokenX: IERC20, tokenY: IERC20, amount0: number, amount1: number) {
      await depositOrder(delay, tokenX, tokenY, wallet, {
        amount0: expandTo18Decimals(amount0),
        amount1: expandTo18Decimals(amount1),
        gasLimit: 750000,
      })
    }

    async function withdraw(tokenX: IERC20, tokenY: IERC20, pair: TwapPair, liquidity: number) {
      await withdrawOrder(delay, pair, tokenX, tokenY, wallet, {
        liquidity: expandTo18Decimals(liquidity),
        gasLimit: 600000,
      })
    }

    async function buy(tokenIn: IERC20, tokenOut: IERC20, amountInMax: number, amountOut: number) {
      await buyOrder(delay, tokenIn, tokenOut, wallet, {
        amountInMax: expandTo18Decimals(amountInMax),
        amountOut: expandTo18Decimals(amountOut),
      })
    }

    async function sell(tokenIn: IERC20, tokenOut: IERC20, amountIn: number, amountOutMin: number) {
      await sellOrder(delay, tokenIn, tokenOut, wallet, {
        amountIn: expandTo18Decimals(amountIn),
        amountOutMin: expandTo18Decimals(amountOutMin),
      })
    }

    let initialToken0Amount = await token0.balanceOf(wallet.address)
    let initialToken1Amount = await token1.balanceOf(wallet.address)
    const deposit0 = { amount0: 10, amount1: 15 }
    const deposit1 = { amount0: 2, amount1: 5 }

    await deposit(token0, token1, deposit0.amount0, deposit0.amount1)
    const token0MaxIn = 10
    const token1Out = 3
    await buy(token0, token1, token0MaxIn, token1Out)
    await deposit(token0, token1, deposit1.amount0, deposit1.amount1)

    await increaseTime(wallet, DELAY + 1)

    let tx = await delay.execute(3, overrides)
    let events = await getEvents(tx, 'OrderExecuted')

    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(2, true, '0x', getGasSpent(events[1]), getEthRefund(events[1]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(3, true, '0x', getGasSpent(events[2]), getEthRefund(events[2]))

    const token0Deposited = expandTo18Decimals(deposit0.amount0 + deposit1.amount0)
    const token1Deposited = expandTo18Decimals(deposit0.amount1 + deposit1.amount1)
    const excessedToken1Deposit = expandTo18Decimals(
      deposit1.amount1 - (deposit0.amount1 / deposit0.amount0) * deposit1.amount0
    )

    expect(await token0.balanceOf(wallet.address)).to.gt(
      initialToken0Amount.sub(token0Deposited).sub(expandTo18Decimals(token0MaxIn))
    )
    expect(await token1.balanceOf(wallet.address)).to.gt(
      initialToken1Amount.sub(token1Deposited).add(expandTo18Decimals(token1Out))
    )
    expect(await token1.balanceOf(wallet.address)).to.lt(
      initialToken1Amount.sub(token1Deposited).add(expandTo18Decimals(token1Out)).add(excessedToken1Deposit)
    )

    await sell(token0, token1, 3, 4)
    const amount0BeforeWithdraw = await token0.balanceOf(wallet.address)
    const amount1BeforeWithdraw = await token1.balanceOf(wallet.address)
    await withdraw(token0, token1, pair01, 5)

    await increaseTime(wallet, DELAY + 1)

    tx = await delay.execute(2, overrides)
    events = await getEvents(tx, 'OrderExecuted')

    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(4, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(5, true, '0x', getGasSpent(events[1]), getEthRefund(events[1]))

    expect(await token0.balanceOf(wallet.address)).to.gt(amount0BeforeWithdraw)
    expect(await token1.balanceOf(wallet.address)).to.gt(amount1BeforeWithdraw)

    let initialToken2Amount = await token2.balanceOf(wallet.address)
    let initialToken3Amount = await token3.balanceOf(wallet.address)
    await deposit(token2, token3, 20, 30)
    await sell(token2, token3, 4, 1)

    await swapOnUniswapPair(uniswapPair23, 50, token3)

    await buy(token2, token3, 4, 1)
    await deposit(token2, token3, 15, 15)

    await increaseTime(wallet, DELAY + 1)

    tx = await delay.execute(4, overrides)
    events = await getEvents(tx, 'OrderExecuted')

    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(6, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(7, true, '0x', getGasSpent(events[1]), getEthRefund(events[1]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(8, true, '0x', getGasSpent(events[2]), getEthRefund(events[2]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(9, true, '0x', getGasSpent(events[3]), getEthRefund(events[3]))

    expect(await token2.balanceOf(wallet.address)).to.gt(initialToken2Amount)
    expect(await token3.balanceOf(wallet.address)).to.lt(initialToken3Amount)

    initialToken0Amount = await token0.balanceOf(wallet.address)
    initialToken1Amount = await token1.balanceOf(wallet.address)
    initialToken2Amount = await token2.balanceOf(wallet.address)
    initialToken3Amount = await token3.balanceOf(wallet.address)

    await withdraw(token2, token3, pair23, 5)
    await sell(token3, token2, 4, 1)

    await swapOnUniswapPair(uniswapPair01, 30, token1)

    await deposit(token0, token1, 10, 10)
    await buy(token1, token0, 10, 3)

    await swapOnUniswapPair(uniswapPair01, 80, token0)

    await buy(token2, token3, 10, 2)
    await withdraw(token2, token3, pair23, 10)

    await swapOnUniswapPair(uniswapPair23, 40, token2)

    await buy(token3, token2, 5, 1)
    await sell(token1, token0, 7, 2)

    await increaseTime(wallet, DELAY + 1)

    tx = await delay.execute(8, overrides)
    events = await getEvents(tx, 'OrderExecuted')

    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(10, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(11, true, '0x', getGasSpent(events[1]), getEthRefund(events[1]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(12, true, '0x', getGasSpent(events[2]), getEthRefund(events[2]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(13, true, '0x', getGasSpent(events[3]), getEthRefund(events[3]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(14, true, '0x', getGasSpent(events[4]), getEthRefund(events[4]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(15, true, '0x', getGasSpent(events[5]), getEthRefund(events[5]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(16, true, '0x', getGasSpent(events[6]), getEthRefund(events[6]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(17, true, '0x', getGasSpent(events[7]), getEthRefund(events[7]))

    expect(await token0.balanceOf(wallet.address)).to.lt(initialToken0Amount)
    expect(await token1.balanceOf(wallet.address)).to.lt(initialToken1Amount)
    expect(await token2.balanceOf(wallet.address)).to.lt(initialToken2Amount)
    expect(await token3.balanceOf(wallet.address)).to.gt(initialToken3Amount)
  }).timeout(30_000)
})
