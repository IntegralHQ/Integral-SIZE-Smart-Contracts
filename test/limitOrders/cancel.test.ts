import { expect } from 'chai'
import { constants, providers } from 'ethers'
import { getBuyOrderData, getDefaultLimitOrderBuy, getDefaultLimitOrderSell, getSellOrderData } from '../shared/orders'
import { delayOracleV3Fixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { MAX_UINT_256, mineBlock, overrides } from '../shared/utilities'
import { LimitOrderType } from '../shared/LimitOrderType'
import { LimitOrderStatus } from '../shared/LimitOrderStatus'
import { delayFailingFixture } from '../shared/fixtures/delayFailingFixture'
import { utils, BigNumber } from 'ethers'
import { OrderInternalType } from '../shared/OrderType'

describe('TwapLimitOrder.cancelOrder', () => {
  const loadFixture = setupFixtureLoader()

  it('cancel a order with wrapUnwrap as false', async () => {
    const { limitOrder, delay, weth, token, wallet } = await loadFixture(delayOracleV3Fixture)

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice)
    await limitOrder.approve(token.address, MAX_UINT_256, delay.address)
    await limitOrder.approve(weth.address, MAX_UINT_256, delay.address)

    await token.approve(limitOrder.address, constants.MaxUint256, overrides)
    await weth.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.setTwapPrice(20)

    const buyRequest = getDefaultLimitOrderBuy(weth, token, wallet)
    await weth.deposit({
      value: buyRequest.amountInMax,
    })

    const balanceBefore = await weth.balanceOf(wallet.address)
    const value = gasPrice.mul(buyRequest.gasLimit).mul(2)
    buyRequest.wrapUnwrap = false
    const ethBalanceBefore = await wallet.getBalance()
    let tx = await limitOrder.buy(buyRequest, 30, 10, {
      ...overrides,
      value: value,
    })
    let receipt = await tx.wait()
    let gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    const newestOrderId = await limitOrder.newestOrderId()
    const orderStatus = await limitOrder.getOrderStatus(newestOrderId)
    expect(orderStatus).to.eq(LimitOrderStatus.Waiting)
    tx = await limitOrder.cancelOrder(newestOrderId, overrides)
    receipt = await tx.wait()
    gasUsed = gasUsed.add(receipt.gasUsed.mul(receipt.effectiveGasPrice))
    const ethBalanceAfter = await wallet.getBalance()
    expect(ethBalanceBefore.sub(gasUsed).eq(ethBalanceAfter)).to.be.true

    const balanceAfter = await weth.balanceOf(wallet.address)
    expect(balanceBefore).to.equal(balanceAfter)
  })

  it('cancel a order with wrapUnwrap as true', async () => {
    const { limitOrder, delay, weth, token, wallet } = await loadFixture(delayOracleV3Fixture)

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice)
    await limitOrder.approve(token.address, MAX_UINT_256, delay.address)
    await limitOrder.approve(weth.address, MAX_UINT_256, delay.address)
    const balanceBefore = await token.balanceOf(wallet.address)

    await token.approve(limitOrder.address, constants.MaxUint256, overrides)
    await weth.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.setTwapPrice(20)

    const buyRequest = getDefaultLimitOrderBuy(weth, token, wallet)
    const wethAmount = 1000
    buyRequest.amountInMax = BigNumber.from(wethAmount)
    const value = gasPrice.mul(buyRequest.gasLimit).mul(2).add(wethAmount)
    buyRequest.wrapUnwrap = true
    const ethBalanceBefore = await wallet.getBalance()
    let tx = await limitOrder.buy(buyRequest, 30, 10, {
      ...overrides,
      value: value,
    })
    let receipt = await tx.wait()
    let gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    const newestOrderId = await limitOrder.newestOrderId()
    const orderStatus = await limitOrder.getOrderStatus(newestOrderId)
    expect(orderStatus).to.eq(LimitOrderStatus.Waiting)
    tx = await limitOrder.cancelOrder(newestOrderId, overrides)
    receipt = await tx.wait()
    gasUsed = gasUsed.add(receipt.gasUsed.mul(receipt.effectiveGasPrice))
    const ethBalanceAfter = await wallet.getBalance()
    expect(ethBalanceBefore.sub(gasUsed).eq(ethBalanceAfter)).to.be.true

    const balanceAfter = await token.balanceOf(wallet.address)
    expect(balanceBefore).to.equal(balanceAfter)
  })

  it('cancel a waiting order with expected emitted events', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    await limitOrder.setTwapPrice(10)
    await limitOrder.buy(buyRequest, 1, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })

    const newestOrderId = await limitOrder.newestOrderId()
    await expect(limitOrder.cancelOrder(newestOrderId))
      .to.emit(limitOrder, 'OrderCancelled')
      .withNamedArgs({
        orderId: BigNumber.from(1),
      })
  })

  it('cancel a buy waiting order', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    const balanceBefore = await token0.balanceOf(wallet.address)
    await limitOrder.setTwapPrice(10)
    const ethBalanceBefore = await wallet.getBalance()
    let tx = await limitOrder.buy(buyRequest, 1, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })
    let receipt = await tx.wait()
    let gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)

    const newestOrderId = await limitOrder.newestOrderId()
    const order = await limitOrder.getOrder(newestOrderId)

    expect(order.orderType).to.equal(LimitOrderType.Buy)
    expect(order.status).to.equal(LimitOrderStatus.Waiting)

    tx = await limitOrder.cancelOrder(newestOrderId)
    receipt = await tx.wait()
    gasUsed = gasUsed.add(receipt.gasUsed.mul(receipt.effectiveGasPrice))
    const ethBalanceAfter = await wallet.getBalance()

    const balanceAfter = await token0.balanceOf(wallet.address)
    expect(balanceBefore).to.equal(balanceAfter)
    expect(ethBalanceBefore.sub(gasUsed).eq(ethBalanceAfter)).to.be.true
  })

  it('cancel refund should not change when gasMultiplier changed', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    const balanceBefore = await token0.balanceOf(wallet.address)
    await limitOrder.setTwapPrice(10)
    const ethBalanceBefore = await wallet.getBalance()
    let tx = await limitOrder.buy(buyRequest, 1, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })
    let receipt = await tx.wait()
    let gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)

    const newestOrderId = await limitOrder.newestOrderId()
    const order = await limitOrder.getOrder(newestOrderId)

    expect(order.orderType).to.equal(LimitOrderType.Buy)
    expect(order.status).to.equal(LimitOrderStatus.Waiting)

    tx = await limitOrder.setGasMultiplier(utils.parseUnits('3'))
    receipt = await tx.wait()
    gasUsed = gasUsed.add(receipt.gasUsed.mul(receipt.effectiveGasPrice))

    tx = await limitOrder.cancelOrder(newestOrderId)
    receipt = await tx.wait()
    gasUsed = gasUsed.add(receipt.gasUsed.mul(receipt.effectiveGasPrice))
    const ethBalanceAfter = await wallet.getBalance()

    const balanceAfter = await token0.balanceOf(wallet.address)
    expect(balanceBefore).to.equal(balanceAfter)
    expect(ethBalanceBefore.sub(gasUsed).eq(ethBalanceAfter)).to.be.true
  })

  it('cancel a sell waiting order', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const sellRequest = getDefaultLimitOrderSell(token0, token1, wallet)
    const balanceBefore = await token0.balanceOf(wallet.address)

    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.setTwapPrice(10)

    const ethBalanceBefore = await wallet.getBalance()
    let tx = await limitOrder.sell(sellRequest, 11, 10, {
      ...overrides,
      value: gasPrice.mul(sellRequest.gasLimit).mul(2),
    })
    let receipt = await tx.wait()
    let gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)

    const newestOrderId = await limitOrder.newestOrderId()
    const order = await limitOrder.getOrder(newestOrderId)

    expect(order.orderType).to.equal(LimitOrderType.Sell)
    expect(order.status).to.equal(LimitOrderStatus.Waiting)

    tx = await limitOrder.cancelOrder(newestOrderId)
    receipt = await tx.wait()
    gasUsed = gasUsed.add(receipt.gasUsed.mul(receipt.effectiveGasPrice))
    const ethBalanceAfter = await wallet.getBalance()

    const balanceAfter = await token0.balanceOf(wallet.address)
    expect(balanceBefore).to.equal(balanceAfter)
    expect(ethBalanceBefore.sub(gasUsed).eq(ethBalanceAfter)).to.be.true
  })

  it('cancel a buy submitted order', async () => {
    const { limitOrder, delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    await delay.setGasPrice(gasPrice)
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    const balanceBefore = await token0.balanceOf(wallet.address)
    await limitOrder.approve(token0.address, MAX_UINT_256, delay.address)

    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    await limitOrder.setTwapPrice(1)

    const ethBalanceBefore = await wallet.getBalance()

    let tx = await limitOrder.buy(buyRequest, 1, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })
    let receipt = await tx.wait()
    let gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)

    const newestOrderId = await limitOrder.newestOrderId()
    tx = await limitOrder.executeOrders([newestOrderId], overrides)
    receipt = await tx.wait()
    gasUsed = gasUsed.add(receipt.gasUsed.mul(receipt.effectiveGasPrice))
    const delayOrder = getBuyOrderData(receipt)[0]

    const order = await limitOrder.getOrder(newestOrderId)

    expect(order.orderType).to.equal(LimitOrderType.Buy)
    expect(order.status).to.equal(LimitOrderStatus.Submitted)

    const delayOrderId = await limitOrder.getDelayOrderId(newestOrderId)
    expect(delayOrder.orderId).to.equal(delayOrderId)
    expect(delayOrder.orderType).to.equal(OrderInternalType.BUY_TYPE)

    await (limitOrder.provider as providers.JsonRpcProvider).send('evm_increaseTime', [24 * 60 * 60 + 1])

    tx = await delay.cancelOrder(delayOrder, overrides)

    receipt = await tx.wait()
    gasUsed = gasUsed.add(receipt.gasUsed.mul(receipt.effectiveGasPrice))
    const ethBalanceAfter = await wallet.getBalance()

    const balanceAfter = await token0.balanceOf(wallet.address)
    expect(balanceBefore).to.equal(balanceAfter)
    expect(ethBalanceBefore.sub(gasUsed).eq(ethBalanceAfter)).to.be.true
  })

  it('cancel a sell submitted order', async () => {
    const { limitOrder, delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    await delay.setGasPrice(gasPrice)
    const sellRequest = getDefaultLimitOrderSell(token0, token1, wallet)
    const balanceBefore = await token0.balanceOf(wallet.address)
    await limitOrder.approve(token0.address, MAX_UINT_256, delay.address)

    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
    await token1.approve(limitOrder.address, constants.MaxUint256, overrides)

    await limitOrder.setTwapPrice(2)

    const ethBalanceBefore = await wallet.getBalance()
    let tx = await limitOrder.sell(sellRequest, 1, 10, {
      ...overrides,
      value: gasPrice.mul(sellRequest.gasLimit).mul(2),
    })
    let receipt = await tx.wait()
    let gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)

    const newestOrderId = await limitOrder.newestOrderId()

    tx = await limitOrder.executeOrders([newestOrderId], overrides)
    receipt = await tx.wait()
    gasUsed = gasUsed.add(receipt.gasUsed.mul(receipt.effectiveGasPrice))
    const delayOrder = getSellOrderData(receipt)[0]

    const order = await limitOrder.getOrder(newestOrderId)
    expect(order.orderType).to.equal(LimitOrderType.Sell)
    expect(order.status).to.equal(LimitOrderStatus.Submitted)

    const delayOrderId = await limitOrder.getDelayOrderId(newestOrderId)
    expect(delayOrder.orderId).to.equal(delayOrderId)
    expect(delayOrder.orderType).to.equal(OrderInternalType.SELL_TYPE)

    await (limitOrder.provider as providers.JsonRpcProvider).send('evm_increaseTime', [24 * 60 * 60 + 1])

    tx = await delay.cancelOrder(delayOrder, overrides)
    receipt = await tx.wait()
    gasUsed = gasUsed.add(receipt.gasUsed.mul(receipt.effectiveGasPrice))
    const ethBalanceAfter = await wallet.getBalance()

    const balanceAfter = await token0.balanceOf(wallet.address)
    expect(balanceBefore).to.equal(balanceAfter)

    expect(ethBalanceBefore.sub(gasUsed).eq(ethBalanceAfter)).to.be.true
  })

  it('cancel a order twice', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    await limitOrder.setTwapPrice(10)
    await limitOrder.buy(buyRequest, 1, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })

    const newestOrderId = await limitOrder.newestOrderId()
    const order = await limitOrder.getOrder(newestOrderId)

    expect(order.orderType).to.equal(LimitOrderType.Buy)
    expect(order.status).to.equal(LimitOrderStatus.Waiting)

    const tx = await limitOrder.cancelOrder(newestOrderId, overrides)
    await tx.wait()
    await expect(limitOrder.cancelOrder(newestOrderId, overrides)).to.revertedWith('TL52')
  })

  it('cancel order belongs to other user', async () => {
    const { limitOrder, token0, token1, wallet, other } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    await limitOrder.setTwapPrice(10)
    await limitOrder.buy(buyRequest, 1, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })

    const newestOrderId = await limitOrder.newestOrderId()
    const order = await limitOrder.getOrder(newestOrderId)

    expect(order.orderType).to.equal(LimitOrderType.Buy)
    expect(order.status).to.equal(LimitOrderStatus.Waiting)

    await expect(limitOrder.connect(other).cancelOrder(newestOrderId, overrides)).to.revertedWith('TL00')
  })

  it('cancel fail order', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayFailingFixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)

    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.setTwapPrice(1010)
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

    await expect(limitOrder.cancelOrder(orderId, overrides)).to.revertedWith('TL52')
  })

  it('cancel an order, when refundFail it should become refundAndGasFailed status', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayFailingFixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)

    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.setTwapPrice(1010)
    await limitOrder.buy(buyRequest, 998, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })

    await token0.setRevertBalanceOf(true, overrides)
    const orderId = await limitOrder.newestOrderId()
    let orderStatus = await limitOrder.getOrderStatus(orderId)
    expect(orderStatus).to.be.eq(LimitOrderStatus.Waiting)
    await limitOrder.setTwapPrice(1000)
    await limitOrder.cancelOrder(orderId, overrides)
    orderStatus = await limitOrder.getOrderStatus(orderId)
    expect(orderStatus).to.be.eq(LimitOrderStatus.RefundAndGasFailed)

    await token0.setRevertBalanceOf(false, overrides)

    const balanceBefore = await wallet.getBalance()
    await limitOrder.retryRefund(orderId)
    const balanceAfter = await wallet.getBalance()

    expect(balanceAfter.gt(balanceBefore)).to.equal(true)
  })

  it('cancel should refund to contract owner when condition satisfied', async () => {
    const { limitOrder, other, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    await limitOrder.setTwapPrice(10)
    await limitOrder.buy(buyRequest, 1, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })

    const newestOrderId = await limitOrder.newestOrderId()
    const order = await limitOrder.getOrder(newestOrderId)

    expect(order.orderType).to.equal(LimitOrderType.Buy)
    expect(order.status).to.equal(LimitOrderStatus.Waiting)

    await (limitOrder.provider as providers.JsonRpcProvider).send('evm_increaseTime', [24 * 60 * 60 * 500])

    await mineBlock(wallet)

    await limitOrder.setBot(other.address, true)
    await limitOrder.setOwner(other.address)
    const balanceBefore = await token0.balanceOf(other.address)
    const ethBalanceBefore = await other.getBalance()
    await limitOrder.connect(other).cancelOrder(newestOrderId, overrides)
    const balanceAfter = await token0.balanceOf(other.address)
    const ethBalanceAfter = await other.getBalance()

    expect(balanceAfter.gt(balanceBefore)).to.be.true
    expect(ethBalanceAfter.gt(ethBalanceBefore)).to.be.true
  })
})
