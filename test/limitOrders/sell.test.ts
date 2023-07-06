import { expect } from 'chai'
import { delayOracleV3Fixture } from '../shared/fixtures'
import { getDefaultLimitOrderSell } from '../shared/orders'
import { setupFixtureLoader } from '../shared/setup'
import { MAX_UINT_256, overrides } from '../shared/utilities'
import { LimitOrderType } from '../shared/LimitOrderType'
import { LimitOrderStatus } from '../shared/LimitOrderStatus'
import { BigNumber, constants } from 'ethers'

describe('TwapLimitOrder.sell', () => {
  const loadFixture = setupFixtureLoader()

  describe('test sell order', () => {
    it('enqueues an order', async () => {
      const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
      const gasPrice = await limitOrder.gasPrice()
      const sellRequest = getDefaultLimitOrderSell(token0, token1, wallet)

      await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
      await limitOrder.setTwapPrice(10)
      await limitOrder.sell(sellRequest, 11, 10, {
        ...overrides,
        value: gasPrice.mul(sellRequest.gasLimit).mul(2),
      })

      const newestOrderId = await limitOrder.newestOrderId()
      const order = await limitOrder.getOrder(newestOrderId)

      expect(order.orderType).to.equal(LimitOrderType.Sell)
      expect(order.status).to.equal(LimitOrderStatus.Waiting)
    })

    it('enqueue with event emitted', async () => {
      const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
      const gasPrice = await limitOrder.gasPrice()
      const sellRequest = getDefaultLimitOrderSell(token0, token1, wallet)

      await token0.approve(limitOrder.address, constants.MaxUint256, overrides)
      await limitOrder.setTwapPrice(10)
      await expect(
        limitOrder.sell(sellRequest, 11, 10, {
          ...overrides,
          value: gasPrice.mul(sellRequest.gasLimit).mul(2),
        })
      )
        .to.emit(limitOrder, 'SellLimitOrderEnqueued')
        .withNamedArgs({
          orderId: BigNumber.from(1),
          amountIn: sellRequest.amountIn,
          amountOut: sellRequest.amountOutMin,
          inverse: false,
          gasLimit: BigNumber.from(sellRequest.gasLimit * 2),
          twapInterval: BigNumber.from(10),
          price: BigNumber.from(11),
        })
    })

    it('enqueues an inverted order', async () => {
      const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
      const gasPrice = await limitOrder.gasPrice()
      const sellRequest = getDefaultLimitOrderSell(token1, token0, wallet)

      await token1.approve(limitOrder.address, constants.MaxUint256, overrides)
      await limitOrder.setTwapPrice(11)
      await limitOrder.sell(sellRequest, 10, 10, {
        ...overrides,
        value: gasPrice.mul(sellRequest.gasLimit).mul(2),
      })

      const newestOrderId = await limitOrder.newestOrderId()
      const order = await limitOrder.getOrder(newestOrderId)

      expect(order.orderType).to.equal(LimitOrderType.Sell)
      expect(order.status).to.equal(LimitOrderStatus.Waiting)
    })

    it('should revert when order enqueue is disabled', async () => {
      const { limitOrder, delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
      const gasPrice = await limitOrder.gasPrice()
      const sellRequest = getDefaultLimitOrderSell(token1, token0, wallet)
      await limitOrder.approve(token1.address, MAX_UINT_256, delay.address)
      await limitOrder.setEnqueueDisabled(true)

      await token1.approve(limitOrder.address, constants.MaxUint256, overrides)

      await limitOrder.setTwapPrice(2)
      await expect(
        limitOrder.sell(sellRequest, 1, 10, {
          ...overrides,
          value: gasPrice.mul(sellRequest.gasLimit).mul(2),
        })
      ).to.revertedWith('TL61')
    })
  })
})
