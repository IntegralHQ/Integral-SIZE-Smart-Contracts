import { expect } from 'chai'
import { BigNumber, utils } from 'ethers'
import { parseUnits } from 'ethers/lib/utils'
import { Orders, OrdersTest } from '../build/types'
import { ordersFixture } from './shared/fixtures'
import {
  getBuyOrderData,
  getDepositOrderData,
  getOrderDigest,
  getSellOrderData,
  getWithdrawOrderData,
} from './shared/orders'
import { setupFixtureLoader } from './shared/setup'
import { overrides } from './shared/utilities'

describe('Orders', () => {
  const TEST_TOKENS: [string, string] = [
    '0x0000000000000000000000000000000000000001',
    '0x0000000000000000000000000000000000000002',
  ]
  const TEST_ADDRESS = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'

  const loadFixture = setupFixtureLoader()
  let orders: OrdersTest
  const orderDataCache: Orders.OrderStruct[] = []

  before(async () => {
    ;({ orders } = await loadFixture(ordersFixture))
  })

  it('enqueueDepositOrder', async () => {
    const gasPrice = utils.parseUnits('123.456', 'gwei')
    const validAfterTimestamp = Math.floor(Date.now() / 1000)
    const depositOrder = [
      TEST_TOKENS, // tokens
      parseUnits('1'), // share0
      parseUnits('1'), // share1
      BigNumber.from(2), // minSwapPrice
      BigNumber.from(3), // maxSwapPrice
      false, // wrap
      true, // swap
      TEST_ADDRESS, // to
      gasPrice, // gasPrice
      BigNumber.from('100000'), // gasLimit
      validAfterTimestamp,
      BigNumber.from('222222'),
    ] as const
    const tx = await orders._enqueueDepositOrder(...depositOrder, overrides)
    const receipt = await tx.wait()
    const orderData = getDepositOrderData(receipt)
    orderDataCache.push(orderData[0])
    await expect(Promise.resolve(tx))
      .to.emit(orders, 'DepositEnqueued')
      .withArgs(1, { ...orderData[0] })

    const orderHashOnChain = await orders.getOrderHash(1, overrides)
    const orderHash = getOrderDigest(orderData[0])
    expect(orderHash).to.be.eq(orderHashOnChain)
    expect(await orders.newestOrderId()).to.eq(1)
    expect(await orders.lastProcessedOrderId()).to.eq(0)
  })

  it('enqueueWithdrawOrder', async () => {
    const gasPrice = utils.parseUnits('123.456', 'gwei')
    const validAfterTimestamp = Math.floor(Date.now() / 1000)
    const withdrawOrder = [
      TEST_TOKENS,
      parseUnits('1'),
      parseUnits('0.5'),
      parseUnits('0.5'),
      false,
      TEST_ADDRESS,
      gasPrice,
      BigNumber.from('100000'),
      validAfterTimestamp,
    ] as const
    const tx = await orders._enqueueWithdrawOrder(...withdrawOrder, overrides)
    const receipt = await tx.wait()
    const orderData = getWithdrawOrderData(receipt)
    orderDataCache.push(orderData[0])
    await expect(Promise.resolve(tx))
      .to.emit(orders, 'WithdrawEnqueued')
      .withArgs(2, { ...orderData[0] })

    const orderHashOnChain = await orders.getOrderHash(2, overrides)
    const orderHash = getOrderDigest(orderData[0])
    expect(orderHash).to.be.eq(orderHashOnChain)
    expect(await orders.lastProcessedOrderId()).to.eq(0)
    expect(await orders.newestOrderId()).to.eq(2)
  })

  it('enqueueSellOrder', async () => {
    const gasPrice = utils.parseUnits('123.456', 'gwei')
    const validAfterTimestamp = Math.floor(Date.now() / 1000)
    const sellOrder = [
      TEST_TOKENS,
      false,
      parseUnits('1'),
      parseUnits('0.5'),
      false,
      TEST_ADDRESS,
      gasPrice,
      BigNumber.from('100000'),
      validAfterTimestamp,
      BigNumber.from('222222'),
      111111,
    ] as const
    const tx = await orders._enqueueSellOrder(...sellOrder, overrides)
    const receipt = await tx.wait()
    const orderData = getSellOrderData(receipt)
    orderDataCache.push(orderData[0])
    await expect(Promise.resolve(tx))
      .to.emit(orders, 'SellEnqueued')
      .withArgs(3, { ...orderData[0] })

    const orderHashOnChain = await orders.getOrderHash(3, overrides)
    const orderHash = getOrderDigest(orderData[0])
    expect(orderHash).to.be.eq(orderHashOnChain)
    expect(await orders.newestOrderId()).to.eq(3)
    expect(await orders.lastProcessedOrderId()).to.eq(0)
  })

  it('enqueueBuyOrder', async () => {
    const gasPrice = utils.parseUnits('123.456', 'gwei')
    const validAfterTimestamp = Math.floor(Date.now() / 1000)
    const buyOrder = [
      TEST_TOKENS,
      false,
      parseUnits('1'),
      parseUnits('0.5'),
      false,
      TEST_ADDRESS,
      gasPrice,
      BigNumber.from('100000'),
      validAfterTimestamp,
      BigNumber.from('222222'),
      111111,
    ] as const
    const tx = await orders._enqueueBuyOrder(...buyOrder, overrides)
    const receipt = await tx.wait()
    const orderData = getBuyOrderData(receipt)
    orderDataCache.push(orderData[0])
    await expect(Promise.resolve(tx))
      .to.emit(orders, 'BuyEnqueued')
      .withArgs(4, { ...orderData[0] })

    const orderHashOnChain = await orders.getOrderHash(4, overrides)
    const orderHash = getOrderDigest(orderData[0])
    expect(orderHash).to.be.eq(orderHashOnChain)
    expect(await orders.newestOrderId()).to.eq(4)
    expect(await orders.lastProcessedOrderId()).to.eq(0)
  })

  it('dequeueDepositOrder', async () => {
    await orders._dequeueOrder(orderDataCache[0].orderId, overrides)
    expect(await orders.newestOrderId()).to.eq(4)
    expect(await orders.lastProcessedOrderId()).to.eq(1)
    await orders.forgetLastProcessedOrder()
    expect(await orders.getOrderHash(1)).to.equal(utils.hexZeroPad(BigNumber.from(0).toHexString(), 32))
  })

  it('dequeueWithdrawOrder', async () => {
    await orders._dequeueOrder(orderDataCache[1].orderId, overrides)
    expect(await orders.newestOrderId()).to.eq(4)
    expect(await orders.lastProcessedOrderId()).to.eq(2)
    await orders.forgetLastProcessedOrder()
    expect(await orders.getOrderHash(2)).to.equal(utils.hexZeroPad(BigNumber.from(0).toHexString(), 32))
  })

  it('dequeueSellOrder', async () => {
    await orders._dequeueOrder(orderDataCache[2].orderId, overrides)
    expect(await orders.newestOrderId()).to.eq(4)
    expect(await orders.lastProcessedOrderId()).to.eq(3)
    await orders.forgetLastProcessedOrder()
    expect(await orders.getOrderHash(3)).to.equal(utils.hexZeroPad(BigNumber.from(0).toHexString(), 32))
  })

  it('dequeueBuyOrder', async () => {
    await orders._dequeueOrder(orderDataCache[3].orderId, overrides)
    expect(await orders.newestOrderId()).to.eq(4)
    expect(await orders.lastProcessedOrderId()).to.eq(4)
    await orders.forgetLastProcessedOrder()
    expect(await orders.getOrderHash(4)).to.equal(utils.hexZeroPad(BigNumber.from(0).toHexString(), 32))
  })
})
