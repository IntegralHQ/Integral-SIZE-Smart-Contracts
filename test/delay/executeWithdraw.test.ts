import { parseUnits } from '@ethersproject/units'
import { expect } from 'chai'
import { BigNumber, providers } from 'ethers'
import { EtherHater__factory } from '../../build/types'
import { delayFixture } from '../shared/fixtures'
import { delayFailingAndWethFixture } from '../shared/fixtures/delayFailingAndWethFixture'
import { deposit, depositAndWait, withdrawAndWait } from '../shared/orders'
import { setupFixtureLoader } from '../shared/setup'
import { encodeErrorData } from '../shared/solidityError'
import {
  expandTo18Decimals,
  getEthRefund,
  getEvents,
  getGasSpent,
  MIN_ALLOWED_GAS_LIMIT,
  overrides,
} from '../shared/utilities'

describe('TwapDelay.executeWithdraw', () => {
  const loadFixture = setupFixtureLoader()

  it('removes the order from the queue', async () => {
    const { delay, token0, token1, wallet, pair } = await loadFixture(delayFixture)

    const depositResult = await depositAndWait(delay, token0, token1, wallet)
    await delay.execute(depositResult.orderData, overrides)

    const withdrawResult = await withdrawAndWait(delay, pair, token0, token1, wallet, {
      gasLimit: 450000,
    })

    const tx = await delay.execute(withdrawResult.orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(2, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
  })

  it('withdraws liquidity', async () => {
    const { delay, token0, token1, wallet, pair, BURN_FEE, PRECISION } = await loadFixture(delayFixture)
    const depositResult = await depositAndWait(delay, token0, token1, wallet)
    await delay.execute(depositResult.orderData, overrides)

    const liquidityBefore = await pair.balanceOf(wallet.address)
    const token0Before = await token0.balanceOf(wallet.address)
    const token1Before = await token1.balanceOf(wallet.address)

    const withdrawResult = await withdrawAndWait(delay, pair, token0, token1, wallet, {
      gasLimit: 450000,
    })

    const token0Amount = await token0.balanceOf(pair.address)
    const token1Amount = await token1.balanceOf(pair.address)

    const feeLiquidity = withdrawResult.liquidity.mul(BURN_FEE).div(PRECISION)
    const effectiveWalletLiquidity = withdrawResult.liquidity.sub(feeLiquidity)
    const expectedToken0Out = effectiveWalletLiquidity.mul(token0Amount).div(expandTo18Decimals(2))
    const expectedToken1Out = effectiveWalletLiquidity.mul(token1Amount).div(expandTo18Decimals(2))

    await delay.execute(withdrawResult.orderData, overrides)

    const liquidityAfter = await pair.balanceOf(wallet.address)
    const token0After = await token0.balanceOf(wallet.address)
    const token1After = await token1.balanceOf(wallet.address)

    expect(liquidityBefore.sub(liquidityAfter)).to.eq(withdrawResult.liquidity)
    expect(token0After.sub(token0Before)).to.eq(expectedToken0Out)
    expect(token1After.sub(token1Before)).to.eq(expectedToken1Out)
  })

  it('fails if amount 0 is less than minimal amount', async () => {
    const { delay, token0, token1, wallet, pair } = await loadFixture(delayFixture)
    const depositResult = await depositAndWait(delay, token0, token1, wallet)
    await delay.execute(depositResult.orderData, overrides)

    const liquidityBefore = await pair.balanceOf(wallet.address)
    const token0Before = await token0.balanceOf(wallet.address)
    const token1Before = await token1.balanceOf(wallet.address)

    const withdrawResult = await withdrawAndWait(delay, pair, token0, token1, wallet, {
      gasLimit: 450000,
      amount0Min: expandTo18Decimals(10),
    })

    const tx = await delay.execute(withdrawResult.orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(2, false, encodeErrorData('TD03'), getGasSpent(events[0]), getEthRefund(events[0]))

    const liquidityAfter = await pair.balanceOf(wallet.address)
    const token0After = await token0.balanceOf(wallet.address)
    const token1After = await token1.balanceOf(wallet.address)

    expect(liquidityBefore.sub(liquidityAfter)).to.eq(0)
    expect(token0After.sub(token0Before)).to.eq(0)
    expect(token1After.sub(token1Before)).to.eq(0)
  })

  it('fails if amount 1 is less than minimal amount', async () => {
    const { delay, token0, token1, wallet, pair } = await loadFixture(delayFixture)
    const depositResult = await depositAndWait(delay, token0, token1, wallet)
    await delay.execute(depositResult.orderData, overrides)

    const liquidityBefore = await pair.balanceOf(wallet.address)
    const token0Before = await token0.balanceOf(wallet.address)
    const token1Before = await token1.balanceOf(wallet.address)

    const withdrawResult = await withdrawAndWait(delay, pair, token0, token1, wallet, {
      gasLimit: 450000,
      amount1Min: expandTo18Decimals(10),
    })

    const tx = await delay.execute(withdrawResult.orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(2, false, encodeErrorData('TD03'), getGasSpent(events[0]), getEthRefund(events[0]))

    const liquidityAfter = await pair.balanceOf(wallet.address)
    const token0After = await token0.balanceOf(wallet.address)
    const token1After = await token1.balanceOf(wallet.address)

    expect(liquidityBefore.sub(liquidityAfter)).to.eq(0)
    expect(token0After.sub(token0Before)).to.eq(0)
    expect(token1After.sub(token1Before)).to.eq(0)
  })

  it('refunds ether to the bot and the user', async () => {
    const { delay, token0, token1, wallet, other, pair, orders } = await loadFixture(delayFixture)

    const depositResult = await depositAndWait(delay, token0, token1, wallet)
    await delay.execute(depositResult.orderData, overrides)

    const withdrawResult = await withdrawAndWait(delay, pair, token0, token1, wallet, {
      gasLimit: 450000,
    })

    const botBalanceBefore = await other.getBalance()
    const userBalanceBefore = await wallet.getBalance()

    const tx = await delay.connect(other).execute(withdrawResult.orderData, overrides)
    const { gasUsed, effectiveGasPrice } = await tx.wait()

    const botBalanceAfter = await other.getBalance()
    const userBalanceAfter = await wallet.getBalance()

    const botRefund = botBalanceAfter.sub(botBalanceBefore).add(gasUsed.mul(effectiveGasPrice))
    const userRefund = userBalanceAfter.sub(userBalanceBefore)

    const minRefund = (await orders.ORDER_BASE_COST())
      .add(await orders.PAIR_TRANSFER_COST())
      .mul(withdrawResult.gasPrice)
    const maxRefund = BigNumber.from(withdrawResult.gasLimit).mul(withdrawResult.gasPrice)
    expect(botRefund).not.to.be.below(minRefund)
    expect(botRefund).not.to.be.above(maxRefund)

    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(2, true, '0x', getGasSpent(events[0]), userRefund)
      .to.emit(delay, 'EthRefund')
      .withArgs(other.address, true, botRefund)
      .to.emit(delay, 'EthRefund')
      .withArgs(wallet.address, true, userRefund)
  })

  it('refund liquidity if execution fail', async () => {
    const { delay, token0, token1, wallet, other, pair } = await loadFixture(delayFixture)

    const depositResult = await depositAndWait(delay, token0, token1, wallet)
    await delay.execute(depositResult.orderData, overrides)

    const liquidityBefore = await pair.balanceOf(wallet.address)

    const withdrawResult = await withdrawAndWait(delay, pair, token0, token1, wallet, {
      gasLimit: 450000,
      amount0Min: expandTo18Decimals(10),
    })

    const liquidityBetween = await pair.balanceOf(wallet.address)

    const tx = await delay.connect(other).execute(withdrawResult.orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(2, false, encodeErrorData('TD03'), getGasSpent(events[0]), getEthRefund(events[0]))

    const liquidityAfter = await pair.balanceOf(wallet.address)

    expect(liquidityBefore.sub(liquidityBetween)).to.eq(withdrawResult.liquidity)
    expect(liquidityAfter.sub(liquidityBefore)).to.eq(0)
  })

  it('hits the 48 hours deadline', async () => {
    const { delay, token0, token1, wallet, pair, addLiquidity } = await loadFixture(delayFixture)
    await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

    const withdrawResult = await withdrawAndWait(delay, pair, token0, token1, wallet, {
      gasLimit: 450000,
    })
    await (delay.provider as providers.JsonRpcProvider).send('evm_increaseTime', [48 * 60 * 60])

    const tx = await delay.execute(withdrawResult.orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, false, encodeErrorData('TD04'), getGasSpent(events[0]), getEthRefund(events[0]))
  })

  it('out of gas', async () => {
    const { delay, token0, token1, wallet, pair, addLiquidity } = await loadFixture(delayFixture)
    await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

    const withdrawResult = await withdrawAndWait(delay, pair, token0, token1, wallet, {
      gasLimit: MIN_ALLOWED_GAS_LIMIT,
    })

    const tx = await delay.execute(withdrawResult.orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, false, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
    expect(await delay.lastProcessedOrderId()).to.eq(1)
    expect(await delay.newestOrderId()).to.eq(1)
  })

  it('does not modify the order if tokens are transferred to pair', async () => {
    const { delay, token0, token1, pair, other, addLiquidity } = await loadFixture(delayFixture)
    await addLiquidity(expandTo18Decimals(1000), expandTo18Decimals(1000))

    await pair.transfer(other.address, expandTo18Decimals(10), overrides)

    const withdrawResult = await withdrawAndWait(delay, pair, token0, token1, other, {
      liquidity: expandTo18Decimals(1),
    })

    await pair.transfer(pair.address, expandTo18Decimals(100), overrides)

    const tx = await delay.execute(withdrawResult.orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))

    const out0 = await token0.balanceOf(other.address)
    const out1 = await token1.balanceOf(other.address)

    expect(out0.lt(expandTo18Decimals(1))).to.be.true
    expect(out1.lt(expandTo18Decimals(1))).to.be.true
  })

  it('can unwrap weth', async () => {
    const { delay, token, weth, wethPair, addLiquidityETH, other } = await loadFixture(delayFixture)
    await addLiquidityETH(expandTo18Decimals(1000), expandTo18Decimals(1000))

    const ethBalanceBefore = await other.getBalance()
    const wethBalanceBefore = await weth.balanceOf(other.address)

    const withdrawResult = await withdrawAndWait(delay, wethPair, token, weth, other, {
      liquidity: expandTo18Decimals(10),
      unwrap: true,
    })

    const tx = await delay.execute(withdrawResult.orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')
    const ethRefund = getEthRefund(events[0])
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, true, '0x', getGasSpent(events[0]), ethRefund)

    const ethBalanceAfter = await other.getBalance()
    const wethBalanceAfter = await weth.balanceOf(other.address)

    expect(ethBalanceAfter.sub(ethRefund).sub(ethBalanceBefore)).to.deep.eq(parseUnits('9.98'))
    expect(wethBalanceBefore).to.deep.eq(wethBalanceAfter)
  })

  it('cannot unwrap WETH', async () => {
    const { delay, token, weth, wethPair, addLiquidityETH, wallet } = await loadFixture(delayFixture)
    await addLiquidityETH(expandTo18Decimals(100), expandTo18Decimals(100))

    const etherHater = await new EtherHater__factory(wallet).deploy(overrides)

    const wethAmount = expandTo18Decimals(20)
    await weth.deposit({ value: wethAmount })
    await weth.transfer(wallet.address, wethAmount, overrides)

    const depositResult = await deposit(delay, token, weth, etherHater, {
      amount0: expandTo18Decimals(10),
      amount1: expandTo18Decimals(10),
    })

    const withdrawResult = await withdrawAndWait(delay, wethPair, token, weth, etherHater, {
      liquidity: expandTo18Decimals(10),
      unwrap: true,
    })

    const wethBalanceBefore = await weth.balanceOf(etherHater.address)
    const balanceBefore = await wallet.provider.getBalance(etherHater.address)
    const orderData = depositResult.orderData.concat(withdrawResult.orderData)
    const tx = await delay.execute(orderData, overrides)
    const wethBalanceAfter = await weth.balanceOf(etherHater.address)
    const balanceAfter = await wallet.provider.getBalance(etherHater.address)

    const orderExecuted = await getEvents(tx, 'OrderExecuted')
    const [event] = await getEvents(tx, 'UnwrapFailed')
    function getAmount(event: any) {
      return event.args.amount
    }
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, true, '0x', getGasSpent(orderExecuted[0]), getEthRefund(orderExecuted[0]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(2, true, '0x', getGasSpent(orderExecuted[1]), getEthRefund(orderExecuted[1]))
      .to.emit(delay, 'UnwrapFailed')
      .withArgs(etherHater.address, getAmount(event))

    expect(balanceBefore).to.eq(balanceAfter)
    expect(wethBalanceAfter.sub(wethBalanceBefore)).to.deep.eq(parseUnits('9.98'))
  })

  it('cannot send token', async () => {
    const { delay, failingToken, weth, wethPair, addLiquidityETH, wallet } = await loadFixture(
      delayFailingAndWethFixture
    )
    await addLiquidityETH(expandTo18Decimals(100), expandTo18Decimals(100))

    const withdrawResult = await withdrawAndWait(delay, wethPair, failingToken, weth, wallet, {
      liquidity: expandTo18Decimals(10),
      unwrap: true,
    })

    await failingToken.setRevertAfter((await failingToken.totalTransfers()) + 1, overrides)
    const tx = await delay.execute(withdrawResult.orderData, { ...overrides })

    const orderExecuted = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, false, encodeErrorData('TH05'), getGasSpent(orderExecuted[0]), getEthRefund(orderExecuted[0]))
  })
})
