import { expect } from 'chai'
import { BigNumber, providers, utils } from 'ethers'
import { buyAndWait, depositAndWait, sellAndWait } from '../shared/orders'
import { delayFixture } from '../shared/fixtures'
import { delayFailingFixture } from '../shared/fixtures/delayFailingFixture'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, getEthRefund, getEvents, getGasSpent, mineBlock, overrides } from '../shared/utilities'
import { encodeErrorData } from '../shared/solidityError'
import { OrderStatus } from '../shared/OrderStatus'

describe('TwapDelay.cancelOrder', () => {
  const loadFixture = setupFixtureLoader()

  it('reverts if order time did not exceed', async () => {
    const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayFixture)
    await addLiquidity(expandTo18Decimals(200), expandTo18Decimals(100))
    const result = await depositAndWait(delay, token0, token1, wallet)

    await expect(delay.cancelOrder(result.orderData[0], overrides)).to.be.revertedWith('TD1C')
    await (delay.provider as providers.JsonRpcProvider).send('evm_increaseTime', [24 * 59 * 60 - 60 * 60])
    await mineBlock(wallet)
    await expect(delay.cancelOrder(result.orderData[0], overrides)).to.be.revertedWith('TD1C')
  })

  it('reverts if order failed to execute', async () => {
    const { provider, delay, token0, token1, addLiquidity, wallet } = await loadFixture(delayFailingFixture)
    await addLiquidity(expandTo18Decimals(200), expandTo18Decimals(100))
    const deposit = await depositAndWait(delay, token0, token1, wallet)

    await token0.setWasteTransferGas(true, overrides)

    const tx = await delay.execute(deposit.orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, false, encodeErrorData('TH05'), getGasSpent(events[0]), getEthRefund(events[0]))
      .to.emit(delay, 'RefundFailed')
      .withArgs(deposit.to, token0.address, deposit.amount0, encodeErrorData('TH05'))
      .to.emit(delay, 'RefundFailed')
      .withArgs(deposit.to, token1.address, deposit.amount1, encodeErrorData('TH05'))
      .to.emit(delay, 'EthRefund')

    await token0.setWasteTransferGas(false, overrides)

    await provider.send('evm_increaseTime', [24 * 60 * 60 + 1])

    await expect(delay.cancelOrder(deposit.orderData[0], overrides)).to.be.revertedWith('TD52')
  })

  it('cancels if time exceeded', async () => {
    const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayFixture)
    await addLiquidity(expandTo18Decimals(200), expandTo18Decimals(100))
    const result = await depositAndWait(delay, token0, token1, wallet)
    await (delay.provider as providers.JsonRpcProvider).send('evm_increaseTime', [24 * 60 * 60 + 1])
    await mineBlock(wallet)

    expect(await delay.isOrderCanceled(1)).to.be.false

    await delay.cancelOrder(result.orderData[0])

    expect(await delay.isOrderCanceled(1)).to.be.true
  })

  it('removes from queue', async () => {
    const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayFixture)
    await addLiquidity(expandTo18Decimals(200), expandTo18Decimals(100))
    const result = await depositAndWait(delay, token0, token1, wallet)
    await (delay.provider as providers.JsonRpcProvider).send('evm_increaseTime', [24 * 60 * 60 + 1])
    await mineBlock(wallet)

    await delay.cancelOrder(result.orderData[0], overrides)

    const orderHashOnChain = await delay.getOrderHash(1, overrides)
    const byte32UndefinedSlot = utils.hexZeroPad(BigNumber.from(0).toHexString(), 32)

    expect(orderHashOnChain).to.eq(byte32UndefinedSlot)
  })

  it('refunds tokens', async () => {
    const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayFixture)
    await addLiquidity(expandTo18Decimals(200), expandTo18Decimals(100))
    const token0Balance = await token0.balanceOf(wallet.address)
    const token1Balance = await token1.balanceOf(wallet.address)

    const result = await depositAndWait(delay, token0, token1, wallet)
    await (delay.provider as providers.JsonRpcProvider).send('evm_increaseTime', [24 * 60 * 60 + 1])
    await mineBlock(wallet)

    await delay.cancelOrder(result.orderData[0], overrides)

    expect(await token0.balanceOf(wallet.address)).to.deep.eq(token0Balance)
    expect(await token1.balanceOf(wallet.address)).to.deep.eq(token1Balance)
  })

  it('cannot cancel twice', async () => {
    const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayFixture)
    await addLiquidity(expandTo18Decimals(200), expandTo18Decimals(100))
    const token0Balance = await token0.balanceOf(wallet.address)
    const token1Balance = await token1.balanceOf(wallet.address)

    const result = await depositAndWait(delay, token0, token1, wallet)
    await (delay.provider as providers.JsonRpcProvider).send('evm_increaseTime', [24 * 60 * 60 + 1])
    await mineBlock(wallet)

    await delay.cancelOrder(result.orderData[0])
    await expect(delay.cancelOrder(result.orderData[0], overrides)).to.be.revertedWith('OS71')

    expect(await token0.balanceOf(wallet.address)).to.deep.eq(token0Balance)
    expect(await token1.balanceOf(wallet.address)).to.deep.eq(token1Balance)
  })

  it('execute ignores canceled orders', async () => {
    const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayFixture)
    await addLiquidity(expandTo18Decimals(200), expandTo18Decimals(100))

    const token0Balance = await token0.balanceOf(wallet.address)
    const token1Balance = await token1.balanceOf(wallet.address)

    const result = await depositAndWait(delay, token0, token1, wallet)
    await (delay.provider as providers.JsonRpcProvider).send('evm_increaseTime', [24 * 60 * 60 + 1])
    await mineBlock(wallet)
    const sell = await sellAndWait(delay, token0, token1, wallet)
    const orderData = result.orderData.concat(sell.orderData)

    await delay.cancelOrder(result.orderData[0], overrides)

    const tx = await delay.execute(orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')

    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(2, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))

    // ensure it doesn't emit OrderExecuted for orderId 1
    expect(events.length).to.eq(1)

    expect(await token0.balanceOf(wallet.address)).to.deep.eq(token0Balance.sub(sell.amountIn))
    expect((await token1.balanceOf(wallet.address)).gt(token1Balance.add(sell.amountOutMin))).to.be.true
  })

  it('executing a canceled order does not accidentally dequeue another one', async () => {
    const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayFixture)
    await addLiquidity(expandTo18Decimals(200), expandTo18Decimals(100))

    const order1 = await depositAndWait(delay, token0, token1, wallet)
    const order2 = await sellAndWait(delay, token0, token1, wallet)
    const order3 = await buyAndWait(delay, token0, token1, wallet)
    await (delay.provider as providers.JsonRpcProvider).send('evm_increaseTime', [24 * 60 * 60 + 1])
    await mineBlock(wallet)

    // cancel order 2
    let tx = await delay.cancelOrder(order2.orderData[0], overrides)

    // verify order 2 was canceled
    expect(await delay.getOrderStatus(2, order2.orderData[0].validAfterTimestamp)).to.eq(OrderStatus.Canceled)
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'EthRefund')
      .withArgs(wallet.address, true, BigNumber.from('40000000000000000'))

    // execute orders 1 and 2
    const ordersToExecute = order1.orderData.concat(order2.orderData)
    tx = await delay.execute(ordersToExecute, overrides)

    // verify that only order 1 was executed
    let events = await getEvents(tx, 'OrderExecuted')
    expect(events.length).to.eq(1)
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
    expect(await delay.lastProcessedOrderId()).to.eq(BigNumber.from(2))

    // execute order 3
    tx = await delay.execute(order3.orderData, overrides)

    // verify order 3 was executed successfully
    events = await getEvents(tx, 'OrderExecuted')
    expect(events.length).to.eq(1)
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(3, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
    expect(await delay.lastProcessedOrderId()).to.eq(BigNumber.from(3))
  })
})
