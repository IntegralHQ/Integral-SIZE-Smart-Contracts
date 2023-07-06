import { delayOracleV3Fixture } from '../shared/fixtures'
import { getDefaultLimitOrderBuy, getDefaultLimitOrderSell } from '../shared/orders'
import { constants } from 'ethers'
import { EXPIRATION_UPPER_LIMIT, mineBlock, overrides } from '../shared/utilities'
import { expect } from 'chai'
import { LimitOrderType } from '../shared/LimitOrderType'
import { LimitOrderStatus } from '../shared/LimitOrderStatus'
import { setupFixtureLoader } from '../shared/setup'

describe('TwapLimitOrder.expiration', () => {
  const loadFixture = setupFixtureLoader()

  it('TwapLimitOrder.defaultExpiration buyOrder', async () => {
    const { provider, limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
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

    let isExpired = await limitOrder.isOrderExpired(newestOrderId)
    expect(isExpired).to.equal(false)

    await provider.send('evm_increaseTime', [EXPIRATION_UPPER_LIMIT + 1])
    await mineBlock(wallet)

    isExpired = await limitOrder.isOrderExpired(newestOrderId)
    expect(isExpired).to.equal(true)
  })

  it('TwapLimitOrder.withExplicitlyExpiration buyOrder', async () => {
    const { provider, limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    await limitOrder.setTwapPrice(10)
    await limitOrder.buyWithExpiration(buyRequest, 1, 10, 30 * 60, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })

    const newestOrderId = await limitOrder.newestOrderId()
    const order = await limitOrder.getOrder(newestOrderId)

    expect(order.orderType).to.equal(LimitOrderType.Buy)
    expect(order.status).to.equal(LimitOrderStatus.Waiting)

    let isExpired = await limitOrder.isOrderExpired(newestOrderId)
    expect(isExpired).to.equal(false)

    await provider.send('evm_increaseTime', [30 * 60 + 1])
    await mineBlock(wallet)

    isExpired = await limitOrder.isOrderExpired(newestOrderId)
    expect(isExpired).to.equal(true)

    const tx = await limitOrder.shouldExecute(newestOrderId)
    const receipt = await tx.wait()
    const executableEvent = await limitOrder.interface.parseLog(receipt.logs[receipt.logs.length - 1])
    expect(executableEvent.args[0]).to.equal(false)
  })

  it('TwapLimitOrder.invalidExpiration buyOrder', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    await limitOrder.setTwapPrice(10)
    await expect(
      limitOrder.buyWithExpiration(buyRequest, 1, 10, 29 * 60, {
        ...overrides,
        value: gasPrice.mul(buyRequest.gasLimit).mul(2),
      })
    ).to.be.revertedWith('TL64')

    await expect(
      limitOrder.buyWithExpiration(buyRequest, 1, 10, EXPIRATION_UPPER_LIMIT + 1, {
        ...overrides,
        value: gasPrice.mul(buyRequest.gasLimit).mul(2),
      })
    ).to.be.revertedWith('TL65')
  })

  it('TwapLimitOrder.defaultExpiration sell order', async () => {
    const { provider, limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const sellRequest = getDefaultLimitOrderSell(token0, token1, wallet)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    await limitOrder.setTwapPrice(1)
    await limitOrder.sell(sellRequest, 10, 10, {
      ...overrides,
      value: gasPrice.mul(sellRequest.gasLimit).mul(2),
    })

    const newestOrderId = await limitOrder.newestOrderId()
    const order = await limitOrder.getOrder(newestOrderId)

    expect(order.orderType).to.equal(LimitOrderType.Sell)
    expect(order.status).to.equal(LimitOrderStatus.Waiting)

    let isExpired = await limitOrder.isOrderExpired(newestOrderId)
    expect(isExpired).to.equal(false)

    await provider.send('evm_increaseTime', [EXPIRATION_UPPER_LIMIT + 1])
    await mineBlock(wallet)

    isExpired = await limitOrder.isOrderExpired(newestOrderId)
    expect(isExpired).to.equal(true)
  })

  it('TwapLimitOrder.withExplicitlyExpiration sell order', async () => {
    const { provider, limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const sellRequest = getDefaultLimitOrderSell(token0, token1, wallet)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    await limitOrder.setTwapPrice(1)
    await limitOrder.sellWithExpiration(sellRequest, 10, 10, 30 * 60, {
      ...overrides,
      value: gasPrice.mul(sellRequest.gasLimit).mul(2),
    })

    const newestOrderId = await limitOrder.newestOrderId()
    const order = await limitOrder.getOrder(newestOrderId)

    expect(order.orderType).to.equal(LimitOrderType.Sell)
    expect(order.status).to.equal(LimitOrderStatus.Waiting)

    let isExpired = await limitOrder.isOrderExpired(newestOrderId)
    expect(isExpired).to.equal(false)

    await provider.send('evm_increaseTime', [30 * 60 + 1])
    await mineBlock(wallet)

    isExpired = await limitOrder.isOrderExpired(newestOrderId)
    expect(isExpired).to.equal(true)
  })

  it('TwapLimitOrder.invalidExpiration sell order', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const sellRequest = getDefaultLimitOrderSell(token0, token1, wallet)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    await limitOrder.setTwapPrice(10)
    await expect(
      limitOrder.sellWithExpiration(sellRequest, 1, 10, 29 * 60, {
        ...overrides,
        value: gasPrice.mul(sellRequest.gasLimit).mul(2),
      })
    ).to.be.revertedWith('TL64')

    await expect(
      limitOrder.sellWithExpiration(sellRequest, 1, 10, EXPIRATION_UPPER_LIMIT + 1, {
        ...overrides,
        value: gasPrice.mul(sellRequest.gasLimit).mul(2),
      })
    ).to.be.revertedWith('TL65')
  })
})
