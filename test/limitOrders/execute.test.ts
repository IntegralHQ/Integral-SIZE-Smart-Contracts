import { delayFailingFixture } from '../shared/fixtures/delayFailingFixture'
import { getBuyOrderData, getDefaultLimitOrderBuy, getDefaultLimitOrderSell } from '../shared/orders'
import { constants } from 'ethers'
import {
  DELAY,
  expandTo18Decimals,
  EXPIRATION_UPPER_LIMIT,
  MAX_UINT_256,
  mineBlock,
  overrides,
} from '../shared/utilities'
import { expect } from 'chai'
import { LimitOrderStatus } from '../shared/LimitOrderStatus'
import { setupFixtureLoader } from '../shared/setup'
import { delayOracleV3Fixture } from '../shared/fixtures'
import { BigNumber, utils } from 'ethers'
import { OrderStatus } from '../shared/OrderStatus'

describe('TwapLimitOrder.executeOrders', () => {
  const loadFixture = setupFixtureLoader()

  it('order should reverted, if executor is not a bot', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.setBot(wallet.address, false)

    await limitOrder.setTwapPrice(8)
    await limitOrder.buy(buyRequest, 1, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })
    await limitOrder.setTwapPrice(10)

    const orderId = await limitOrder.newestOrderId()
    await expect(limitOrder.executeOrders([orderId], overrides)).to.revertedWith('TL00')
  })

  it('order should not execute when price is not meet', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    await limitOrder.setTwapPrice(10)
    const tx = await limitOrder.buy(buyRequest, 12, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })
    await tx.wait()
    const orderId = await limitOrder.newestOrderId()
    await expect(limitOrder.executeOrders([orderId], overrides))
      .to.emit(limitOrder, 'OrderExecuted')
      .withNamedArgs({
        success: false,
      })
    const order = await limitOrder.getOrder(orderId)
    expect(order.status).to.eq(LimitOrderStatus.Waiting)
  })

  it('order should execute when price tolerance is changed', async () => {
    const { limitOrder, delay, factory, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.approve(token0.address, MAX_UINT_256, delay.address)

    await limitOrder.setTwapPrice(10)
    await limitOrder.buy(buyRequest, 9, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })
    const orderId = await limitOrder.newestOrderId()
    const pair = await factory.getPair(token0.address, token1.address, overrides)
    await limitOrder.setPriceTolerance(pair, BigNumber.from(800))
    const tx = await limitOrder.shouldExecute(orderId)
    const receipt = await tx.wait()
    const executableEvent = await limitOrder.interface.parseLog(receipt.logs[receipt.logs.length - 1])
    expect(executableEvent.args[0]).to.equal(true)
    await limitOrder.executeOrders([orderId], overrides)
    const order = await limitOrder.getOrder(orderId)
    expect(order.status).to.eq(LimitOrderStatus.Submitted)
  })

  it('order execution reverted due to expiration', async () => {
    const { provider, limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)

    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.setTwapPrice(1010)
    await limitOrder.buy(buyRequest, 800, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })
    await provider.send('evm_increaseTime', [EXPIRATION_UPPER_LIMIT + 1])
    await mineBlock(wallet)
    await limitOrder.setTwapPrice(500)

    const orderId = await limitOrder.newestOrderId()
    const expired = await limitOrder.isOrderExpired(orderId)
    expect(expired).to.equal(true)
    const tx = await limitOrder.shouldExecute(orderId)
    const receipt = await tx.wait()
    const executableEvent = await limitOrder.interface.parseLog(receipt.logs[receipt.logs.length - 1])
    expect(executableEvent.args[0]).to.equal(false)
    await expect(limitOrder.executeOrders([orderId], overrides))
      .to.emit(limitOrder, 'OrderExecuted')
      .withNamedArgs({
        success: false,
      })
  })

  it('order fail and mark order refund failed', async () => {
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
  })

  it('order execution fail and mark order failed', async () => {
    const { limitOrder, factory, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    await limitOrder.setTwapPrice(10)
    const balanceBefore = await wallet.getBalance()
    let tx = await limitOrder.buy(buyRequest, 9, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })
    let receipt = await tx.wait()
    let gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)

    const orderId = await limitOrder.newestOrderId()
    const pair = await factory.getPair(token0.address, token1.address, overrides)
    tx = await limitOrder.setPriceTolerance(pair, BigNumber.from(800), overrides)
    receipt = await tx.wait()
    gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice).add(gasUsed)

    tx = await limitOrder.executeOrders([orderId], overrides)
    receipt = await tx.wait()
    gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice).add(gasUsed)

    const balanceAfter = await wallet.getBalance()

    const orderStatus = await limitOrder.getOrderStatus(orderId)
    expect(orderStatus).to.be.eq(LimitOrderStatus.Fail)
    expect(balanceBefore.sub(gasUsed).eq(balanceAfter)).to.be.true
  })

  it('successfully executed with proper gas refund sell', async () => {
    const { limitOrder, delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const sellRequest = getDefaultLimitOrderSell(token0, token1, wallet)
    await limitOrder.approve(token0.address, MAX_UINT_256, delay.address)

    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.setTwapPrice(1010)
    await limitOrder.sell(sellRequest, 800, 10, {
      ...overrides,
      value: gasPrice.mul(sellRequest.gasLimit).mul(2),
    })

    await limitOrder.setTwapPrice(800)
    const orderId = await limitOrder.newestOrderId()
    const balanceBefore = await wallet.getBalance()
    const tx = await limitOrder.executeOrders([orderId], overrides)
    const receipt = await tx.wait()
    const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    const balanceAfter = await wallet.getBalance()
    const orderStatus = await limitOrder.getOrderStatus(orderId)
    expect(orderStatus).to.be.eq(LimitOrderStatus.Submitted)

    expect(balanceAfter.add(gasUsed).sub(balanceBefore).eq(gasPrice.mul(sellRequest.gasLimit))).to.be.true
  })

  it('successfully executed with proper gas refund buy', async () => {
    const { limitOrder, delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await limitOrder.approve(token0.address, MAX_UINT_256, delay.address)

    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.setTwapPrice(1010)
    await limitOrder.buy(buyRequest, 800, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })

    await limitOrder.setTwapPrice(800)
    const orderId = await limitOrder.newestOrderId()
    const balanceBefore = await wallet.getBalance()
    const tx = await limitOrder.executeOrders([orderId], overrides)
    const receipt = await tx.wait()
    const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    const balanceAfter = await wallet.getBalance()
    const orderStatus = await limitOrder.getOrderStatus(orderId)
    expect(orderStatus).to.be.eq(LimitOrderStatus.Submitted)

    expect(balanceAfter.add(gasUsed).sub(balanceBefore).eq(gasPrice.mul(buyRequest.gasLimit))).to.be.true
  })

  it('execution should be reverted when gasPrice increased and surpass', async () => {
    const { limitOrder, provider, delay, token0, token1, wallet, addLiquidity } = await loadFixture(
      delayOracleV3Fixture
    )
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    const anotherBuyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)

    await delay.setBot(wallet.address, true)
    await limitOrder.approve(token0.address, MAX_UINT_256, delay.address)

    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.setTwapPrice(1010)
    await limitOrder.buy(buyRequest, 800, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })
    const orderId = await limitOrder.newestOrderId()
    await limitOrder.buy(anotherBuyRequest, 800, 10, {
      ...overrides,
      value: gasPrice.mul(anotherBuyRequest.gasLimit).mul(2),
    })

    await limitOrder.setTwapPrice(800)
    const theBuyReqeust = getDefaultLimitOrderBuy(token0, token1, wallet)

    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.setGasMultiplier(utils.parseUnits('1'))
    expect(
      await limitOrder.buy(theBuyReqeust, 500, 10, {
        ...overrides,
        value: gasPrice.mul(theBuyReqeust.gasLimit).mul(2),
      })
    )
      .to.emit(limitOrder, 'BuyLimitOrderEnqueued')
      .withNamedArgs({
        gasPrice: gasPrice,
      })

    const tx = await limitOrder.executeOrders([orderId], overrides)
    const orderStatus = await limitOrder.getOrderStatus(orderId)
    expect(orderStatus).to.be.eq(LimitOrderStatus.Submitted)
    const receipt = await tx.wait()
    const delayOrder = getBuyOrderData(receipt)[0]

    await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))
    await provider.send('evm_increaseTime', [DELAY + 1])
    await mineBlock(wallet)

    await expect(delay.execute([delayOrder], { ...overrides, gasPrice: 111111111111 }))
      .to.emit(delay, 'OrderExecuted')
      .withNamedArgs({
        success: true,
      })

    await limitOrder.setTwapPrice(500)
    const newOrderId = await limitOrder.newestOrderId()
    await expect(limitOrder.executeOrders([newOrderId], overrides))
      .to.emit(limitOrder, 'OrderExecuted')
      .withNamedArgs({
        success: false,
      })
  })

  it('delay execution should not be reverted when gasPrice changed', async () => {
    const { limitOrder, provider, delay, token0, token1, wallet, addLiquidity } = await loadFixture(
      delayOracleV3Fixture
    )
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    const anotherBuyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)

    await delay.setBot(wallet.address, true)
    await limitOrder.approve(token0.address, MAX_UINT_256, delay.address)

    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.setTwapPrice(1010)
    await limitOrder.buy(buyRequest, 800, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })
    let orderId = await limitOrder.newestOrderId()
    await limitOrder.buy(anotherBuyRequest, 800, 10, {
      ...overrides,
      value: gasPrice.mul(anotherBuyRequest.gasLimit).mul(2),
    })

    await limitOrder.setTwapPrice(800)
    const tx = await limitOrder.executeOrders([orderId], overrides)
    await expect(tx).to.emit(limitOrder, 'OrderSubmitted').withNamedArgs({
      success: true,
    })
    const orderStatus = await limitOrder.getOrderStatus(orderId)
    expect(orderStatus).to.be.eq(LimitOrderStatus.Submitted)
    const receipt = await tx.wait()
    const delayOrder = getBuyOrderData(receipt)[0]

    await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))
    await provider.send('evm_increaseTime', [DELAY + 1])
    await mineBlock(wallet)

    const prevGasPrice = await delay.gasPrice()
    await expect(delay.execute([delayOrder], { ...overrides, gasPrice: 111111111111 }))
      .to.emit(delay, 'OrderExecuted')
      .withNamedArgs({
        success: true,
      })

    const updatedGasPrice = await delay.gasPrice()

    expect(updatedGasPrice.gt(prevGasPrice)).to.eq(true)

    const delayId = await limitOrder.getDelayOrderId(orderId)
    const newOrderStatus = await delay.getOrderStatus(delayId, delayOrder.validAfterTimestamp)
    expect(delayId).to.equal(delayOrder.orderId)
    expect(newOrderStatus).to.be.eq(OrderStatus.ExecutedSucceeded)

    orderId = await limitOrder.newestOrderId()
    await expect(limitOrder.executeOrders([orderId], overrides))
      .to.emit(limitOrder, 'OrderExecuted')
      .withNamedArgs({
        success: true,
      })
      .to.emit(limitOrder, 'OrderSubmitted')
      .withNamedArgs({
        success: true,
      })
    const anotherOrderStatus = await limitOrder.getOrderStatus(orderId)
    expect(anotherOrderStatus).to.be.eq(LimitOrderStatus.Submitted)
  })

  it('successfully enqueued delay and executed', async () => {
    const { limitOrder, provider, delay, token0, token1, wallet, addLiquidity } = await loadFixture(
      delayOracleV3Fixture
    )
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await delay.setBot(wallet.address, true)
    await limitOrder.approve(token0.address, MAX_UINT_256, delay.address)

    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.setTwapPrice(1010)
    await limitOrder.buy(buyRequest, 800, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })

    await limitOrder.setTwapPrice(800)
    const orderId = await limitOrder.newestOrderId()
    const tx = await limitOrder.executeOrders([orderId], overrides)
    const orderStatus = await limitOrder.getOrderStatus(orderId)
    expect(orderStatus).to.be.eq(LimitOrderStatus.Submitted)
    const receipt = await tx.wait()
    const delayOrder = getBuyOrderData(receipt)[0]

    await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))
    await provider.send('evm_increaseTime', [DELAY + 1])
    await mineBlock(wallet)

    const prevGasPrice = await delay.gasPrice()
    await expect(delay.execute([delayOrder], { ...overrides, gasPrice: 111111111111 }))
      .to.emit(delay, 'OrderExecuted')
      .withNamedArgs({
        success: true,
      })
    const updatedGasPrice = await delay.gasPrice()

    expect(updatedGasPrice.gt(prevGasPrice)).to.eq(true)

    const delayId = await limitOrder.getDelayOrderId(orderId)
    const newOrderStatus = await delay.getOrderStatus(delayId, delayOrder.validAfterTimestamp)
    expect(delayId).to.equal(delayOrder.orderId)
    expect(newOrderStatus).to.be.eq(OrderStatus.ExecutedSucceeded)
  })
})
