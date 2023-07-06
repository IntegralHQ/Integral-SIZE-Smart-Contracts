import { expect } from 'chai'
import { EtherHaterLimitOrder__factory } from '../../build/types'
import { getDefaultLimitOrderBuy } from '../shared/orders'
import { delayOracleV3Fixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { MAX_UINT_256, overrides } from '../shared/utilities'
import { constants } from 'ethers'
import { LimitOrderStatus } from '../shared/LimitOrderStatus'
import { utils } from 'ethers'

describe('TwapLimitOrder.refund', () => {
  const loadFixture = setupFixtureLoader()

  it('reverts if bot eth refund fails', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const etherHater = await new EtherHaterLimitOrder__factory(wallet).deploy(overrides)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)

    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.setTwapPrice(2)
    await limitOrder.buy(buyRequest, 1, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })
    const orderId = await limitOrder.newestOrderId()
    await limitOrder.setBot(etherHater.address, true)

    const tx = await etherHater.callExecute(limitOrder.address, orderId, overrides)
    expect(tx).to.emit(limitOrder, 'OrderExecuted').withNamedArgs({
      success: false,
    })
  })

  it('no refund when order waiting', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)

    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.setTwapPrice(13)
    const balanceBefore = await wallet.getBalance()
    const gasValue = gasPrice.mul(buyRequest.gasLimit).mul(2)
    const tx = await limitOrder.buy(buyRequest, 11, 10, {
      ...overrides,
      value: gasValue,
    })
    const balanceAfter = await wallet.getBalance()
    const receipt = await tx.wait()
    const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)

    const diff = balanceBefore.sub(balanceAfter).sub(gasUsed)

    expect(gasValue.eq(diff)).to.be.true
  })

  it('refund when order submitted', async () => {
    const { limitOrder, delay, orders, token0, token1, wallet, other } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await limitOrder.setBot(other.address, true)
    await limitOrder.approve(token0.address, MAX_UINT_256, delay.address)

    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.setTwapPrice(100)
    const balanceBefore = await wallet.getBalance()
    let tx = await limitOrder.buy(buyRequest, 99, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })
    let receipt = await tx.wait()
    let gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    const orderId = await limitOrder.newestOrderId()
    const order = await limitOrder.getOrder(orderId)
    expect(order.status).to.be.eq(LimitOrderStatus.Waiting)

    tx = await limitOrder.setTwapPrice(99)
    receipt = await tx.wait()
    gasUsed = gasUsed.add(receipt.gasUsed.mul(receipt.effectiveGasPrice))

    receipt = await tx.wait()
    gasUsed = gasUsed.add(receipt.gasUsed.mul(receipt.effectiveGasPrice))
    const balanceAfter = await wallet.getBalance()

    const botBalanceBefore = await other.getBalance()
    tx = await limitOrder.connect(other).executeOrders([orderId], overrides)
    receipt = await tx.wait()
    const botGasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    const botBalanceAfter = await other.getBalance()

    const diff = balanceBefore.sub(balanceAfter).sub(gasUsed)

    expect(diff.gt(gasPrice.mul(buyRequest.gasLimit))).to.be.true
    expect(diff.gt(gasPrice.mul(buyRequest.gasLimit).mul(2))).to.be.false

    expect(botBalanceAfter.gt(botBalanceBefore.sub(botGasUsed))).to.be.true
    expect(
      botBalanceAfter
        .sub(botBalanceBefore)
        .div(gasPrice)
        .lt(await orders.REFUND_BASE_COST())
    ).to.be.true
  })

  it('refund when order failed', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    await limitOrder.setTwapPrice(10)

    const balanceBefore = await wallet.getBalance()
    let tx = await limitOrder.buy(buyRequest, 11, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })
    let receipt = await tx.wait()
    let gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)

    tx = await limitOrder.setTwapPrice(12)
    receipt = await tx.wait()
    gasUsed = gasUsed.add(receipt.gasUsed.mul(receipt.effectiveGasPrice))

    const orderId = await limitOrder.newestOrderId()
    tx = await limitOrder.executeOrders([orderId], overrides)
    receipt = await tx.wait()
    const orderStatus = await limitOrder.getOrderStatus(orderId)
    expect(orderStatus).to.eq(LimitOrderStatus.Fail)
    gasUsed = gasUsed.add(receipt.gasUsed.mul(receipt.effectiveGasPrice))
    const balanceAfter = await wallet.getBalance()

    const diff = balanceBefore.sub(balanceAfter).sub(gasUsed)

    expect(diff.eq(0)).to.be.true
  })

  it('refund should not change when gasMultiplier changed', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    await limitOrder.setTwapPrice(10)

    const balanceBefore = await wallet.getBalance()
    let tx = await limitOrder.buy(buyRequest, 11, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })
    let receipt = await tx.wait()
    let gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)

    tx = await limitOrder.setTwapPrice(12)
    receipt = await tx.wait()
    gasUsed = gasUsed.add(receipt.gasUsed.mul(receipt.effectiveGasPrice))

    const orderId = await limitOrder.newestOrderId()
    tx = await limitOrder.setGasMultiplier(utils.parseUnits('3'))
    receipt = await tx.wait()
    gasUsed = gasUsed.add(receipt.gasUsed.mul(receipt.effectiveGasPrice))
    tx = await limitOrder.executeOrders([orderId], overrides)
    receipt = await tx.wait()
    gasUsed = gasUsed.add(receipt.gasUsed.mul(receipt.effectiveGasPrice))
    const balanceAfter = await wallet.getBalance()

    const diff = balanceBefore.sub(balanceAfter).sub(gasUsed)

    expect(diff.eq(0)).to.be.true
  })
})
