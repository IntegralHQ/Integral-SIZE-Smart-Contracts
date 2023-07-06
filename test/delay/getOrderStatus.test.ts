import { expect } from 'chai'
import { providers } from 'ethers'
import { EtherHater__factory } from '../../build/types'
import { delayFixture } from '../shared/fixtures'
import { buyAndWait, deposit, depositAndWait } from '../shared/orders'
import { OrderStatus } from '../shared/OrderStatus'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, mineBlock, overrides } from '../shared/utilities'

const DAY = 24 * 60 * 60

describe('TwapDelay.getOrderStatus', () => {
  const loadFixture = setupFixtureLoader()

  it('gets status "NonExistent"', async () => {
    const { delay } = await loadFixture(delayFixture)
    expect(await delay.getOrderStatus(1, Math.floor(Date.now() / 1000))).to.eq(OrderStatus.NonExistent)
  })

  it('gets status "Canceled"', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
    const result = await depositAndWait(delay, token0, token1, wallet)
    const order = result.orderData[0]
    await (delay.provider as providers.JsonRpcProvider).send('evm_increaseTime', [DAY + 1])
    await mineBlock(wallet)
    await delay.cancelOrder(order, overrides)
    expect(await delay.getOrderStatus(order.orderId, order.validAfterTimestamp)).to.eq(OrderStatus.Canceled)
  })

  it('gets status "ExecutedFailed"', async () => {
    const { delay, token, weth, wallet } = await loadFixture(delayFixture)
    const etherHater = await new EtherHater__factory(wallet).deploy(overrides)
    const result = await buyAndWait(delay, weth, token, wallet, {
      to: etherHater.address,
      etherAmount: expandTo18Decimals(1),
      amountInMax: expandTo18Decimals(1),
      amountOut: expandTo18Decimals(1),
      wrapUnwrap: true,
    })
    const order = result.orderData[0]
    await delay.execute([order], overrides)
    expect(await delay.getOrderStatus(order.orderId, order.validAfterTimestamp)).to.eq(OrderStatus.ExecutedFailed)
  })

  it('gets status "ExecutedSucceeded"', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
    const result = await depositAndWait(delay, token0, token1, wallet)
    const order = result.orderData[0]
    await delay.execute([order], overrides)
    expect(await delay.getOrderStatus(order.orderId, order.validAfterTimestamp)).to.eq(OrderStatus.ExecutedSucceeded)
  })

  it('gets status "EnqueuedWaiting"', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
    const result = await deposit(delay, token0, token1, wallet)
    const order = result.orderData[0]
    expect(await delay.getOrderStatus(order.orderId, order.validAfterTimestamp)).to.eq(OrderStatus.EnqueuedWaiting)
  })

  it('gets status "EnqueuedReady"', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
    const result = await depositAndWait(delay, token0, token1, wallet)
    const order = result.orderData[0]
    await mineBlock(wallet)
    expect(await delay.getOrderStatus(order.orderId, order.validAfterTimestamp)).to.eq(OrderStatus.EnqueuedReady)
  })
})
