import { delayOracleV3Fixture } from '../shared/fixtures'
import { getDefaultLimitOrderBuy } from '../shared/orders'
import { constants } from 'ethers'
import { MAX_UINT_256, overrides } from '../shared/utilities'
import { expect } from 'chai'
import { LimitOrderType } from '../shared/LimitOrderType'
import { LimitOrderStatus } from '../shared/LimitOrderStatus'
import { setupFixtureLoader } from '../shared/setup'

describe('TwapLimitOrder.priceTolerance', () => {
  const loadFixture = setupFixtureLoader()

  it('TwapLimitOrder.defaultPriceTolerance', async () => {
    const { limitOrder, delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.approve(token0.address, MAX_UINT_256, delay.address)

    await limitOrder.setTwapPrice(1000)
    await limitOrder.buy(buyRequest, 998, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })

    const newestOrderId = await limitOrder.newestOrderId()

    await limitOrder.executeOrders([newestOrderId], overrides)

    const order = await limitOrder.getOrder(newestOrderId)
    expect(order.orderType).to.equal(LimitOrderType.Buy)
    expect(order.status).to.equal(LimitOrderStatus.Submitted)
  })

  it('TwapLimitOrder.setPriceTolerance', async () => {
    const { limitOrder, factory, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    const pairAddress = await factory.getPair(token0.address, token1.address)
    await limitOrder.setPriceTolerance(pairAddress, 1)

    await limitOrder.setTwapPrice(1000)
    await limitOrder.buy(buyRequest, 998, 10, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit).mul(2),
    })

    const newestOrderId = await limitOrder.newestOrderId()
    const order = await limitOrder.getOrder(newestOrderId)

    expect(order.orderType).to.equal(LimitOrderType.Buy)
    expect(order.status).to.equal(LimitOrderStatus.Waiting)
  })

  it('TwapLimitOrder.setInvalidPriceTolerance', async () => {
    const { limitOrder, factory, token0, token1 } = await loadFixture(delayOracleV3Fixture)
    await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

    const pairAddress = await factory.getPair(token0.address, token1.address)
    await expect(limitOrder.setPriceTolerance(pairAddress, 1001, overrides)).to.be.revertedWith('TL54')
  })
})
