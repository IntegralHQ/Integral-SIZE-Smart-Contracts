import { expect } from 'chai'
import { delayOracleV3Fixture } from '../shared/fixtures'
import { delayFailingFixture } from '../shared/fixtures/delayFailingFixture'
import { getBuyOrderData, getDefaultLimitOrderBuy } from '../shared/orders'
import { setupFixtureLoader } from '../shared/setup'
import { DELAY, MAX_UINT_256, overrides } from '../shared/utilities'
import { constants, providers } from 'ethers'
import { LimitOrderStatus } from '../shared/LimitOrderStatus'
import { OrderStatus } from '../shared/OrderStatus'

describe('TwapLimitOrder.retryRefund', () => {
  const loadFixture = setupFixtureLoader()

  it('reverts for unfailed orders', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)

    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    await limitOrder.setTwapPrice(2)
    await limitOrder.buy(buyRequest, 10, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })
    const orderId = await limitOrder.newestOrderId()
    await limitOrder.executeOrders([orderId], overrides)
    const newestOrderId = await limitOrder.newestOrderId()
    const order = await limitOrder.getOrder(newestOrderId)
    expect(order.status).to.equal(LimitOrderStatus.Waiting)
    await expect(limitOrder.retryRefund(orderId, overrides)).to.revertedWith('TL21')
  })

  it('should not refund twice', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayFailingFixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)

    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.setTwapPrice(1010)
    await limitOrder.buy(buyRequest, 998, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })
    await limitOrder.buy(buyRequest, 998, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })

    await token0.setRevertBalanceOf(true, overrides)
    const orderId = await limitOrder.newestOrderId()
    let orderStatus = await limitOrder.getOrderStatus(orderId)
    expect(orderStatus).to.be.eq(LimitOrderStatus.Waiting)
    await limitOrder.setTwapPrice(1000)
    await limitOrder.executeOrders([orderId], overrides)
    orderStatus = await limitOrder.getOrderStatus(orderId)
    expect(orderStatus).to.be.eq(LimitOrderStatus.RefundFail)

    await token0.setRevertBalanceOf(false, overrides)

    await limitOrder.retryRefund(orderId, overrides)

    const os = await limitOrder.getOrderStatus(orderId)

    expect(os).to.eq(LimitOrderStatus.NonExistent)

    await expect(limitOrder.retryRefund(orderId, overrides)).to.revertedWith('TL21')
  })

  it('refunds tokens', async () => {
    const { limitOrder, delay, token0, token1, wallet } = await loadFixture(delayFailingFixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await limitOrder.setBot(wallet.address, true)
    await limitOrder.approve(token0.address, MAX_UINT_256, delay.address)

    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    const token0InitialBalance = await token0.balanceOf(wallet.address)
    const token1InitialBalance = await token1.balanceOf(wallet.address)

    await limitOrder.setTwapPrice(1010)
    await limitOrder.buy(buyRequest, 998, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })

    const orderId = await limitOrder.newestOrderId()
    await limitOrder.setTwapPrice(1000)
    let tx = await limitOrder.executeOrders([orderId], overrides)
    let orderStatus = await limitOrder.getOrderStatus(orderId)
    expect(orderStatus).to.be.eq(LimitOrderStatus.Submitted)
    await expect(Promise.resolve(tx)).to.emit(limitOrder, 'OrderExecuted')
    const receipt = await tx.wait()
    const delayOrder = getBuyOrderData(receipt)[0]

    await token0.setWasteTransferGas(true, overrides)
    await (delay.provider as providers.JsonRpcProvider).send('evm_increaseTime', [DELAY + 1])
    tx = await delay.execute([delayOrder], overrides)
    const delayId = await limitOrder.getDelayOrderId(orderId)
    orderStatus = await delay.getOrderStatus(delayId, delayOrder.validAfterTimestamp)
    expect(delayOrder.orderId).to.equal(delayId)
    expect(orderStatus).to.be.eq(OrderStatus.ExecutedFailed)
    await expect(Promise.resolve(tx)).to.emit(delay, 'OrderExecuted').to.emit(delay, 'RefundFailed')

    await token0.setWasteTransferGas(false, overrides)
    await delay.retryRefund(delayOrder, overrides)

    expect(await token0.balanceOf(wallet.address)).to.deep.eq(token0InitialBalance)
    expect(await token1.balanceOf(wallet.address)).to.deep.eq(token1InitialBalance)

    orderStatus = await limitOrder.getOrderStatus(orderId)
    expect(orderStatus).to.eq(LimitOrderStatus.Submitted)
  })
})
