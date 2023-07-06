import { expect } from 'chai'
import { delayOracleV3Fixture } from '../shared/fixtures'
import { getDefaultLimitOrderBuy } from '../shared/orders'
import { setupFixtureLoader } from '../shared/setup'
import { MAX_UINT_256, overrides } from '../shared/utilities'
import { LimitOrderType } from '../shared/LimitOrderType'
import { LimitOrderStatus } from '../shared/LimitOrderStatus'
import { BigNumber, constants, utils } from 'ethers'

describe('TwapLimitOrder.buy', () => {
  const loadFixture = setupFixtureLoader()

  describe('test buy order', () => {
    it('enqueues an order', async () => {
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
      expect(order.to).to.equal(buyRequest.to)

      expect(order.to).to.equal(buyRequest.to)
      expect(order.amountOut).to.equal(buyRequest.amountOut)
    })

    it('enqueue with event emitted', async () => {
      const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
      const gasPrice = await limitOrder.gasPrice()
      const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
      await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

      await limitOrder.setTwapPrice(10)
      await expect(
        limitOrder.buy(buyRequest, 1, 10, {
          ...overrides,
          value: gasPrice.mul(buyRequest.gasLimit).mul(2),
        })
      )
        .to.emit(limitOrder, 'BuyLimitOrderEnqueued')
        .withNamedArgs({
          orderId: BigNumber.from(1),
          amountIn: buyRequest.amountInMax,
          amountOut: buyRequest.amountOut,
          inverse: false,
          gasLimit: BigNumber.from(buyRequest.gasLimit * 2),
          twapInterval: BigNumber.from(10),
          price: BigNumber.from(1),
        })
    })

    it('enqueues an inverted order', async () => {
      const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
      const gasPrice = await limitOrder.gasPrice()
      const buyRequest = getDefaultLimitOrderBuy(token1, token0, wallet)
      await token1.approve(limitOrder.address, constants.MaxUint256, overrides)

      await limitOrder.setTwapPrice(10)

      await limitOrder.buy(buyRequest, 11, 10, {
        ...overrides,
        value: gasPrice.mul(buyRequest.gasLimit).mul(2),
      })

      const newestOrderId = await limitOrder.newestOrderId()
      const order = await limitOrder.getOrder(newestOrderId)

      expect(order.orderType).to.equal(LimitOrderType.Buy)
      expect(order.status).to.equal(LimitOrderStatus.Waiting)
      expect(order.to).to.equal(buyRequest.to)

      expect(order.to).to.equal(buyRequest.to)
      expect(order.amountOut).to.equal(buyRequest.amountOut)
    })

    it('refunds excess value', async () => {
      const { limitOrder, delay, token, weth, wallet } = await loadFixture(delayOracleV3Fixture)

      const gasPrice = utils.parseUnits('69.420', 'gwei')
      await delay.setGasPrice(gasPrice)
      await limitOrder.approve(token.address, MAX_UINT_256, delay.address)

      await token.approve(limitOrder.address, constants.MaxUint256, overrides)
      await limitOrder.setTwapPrice(10)

      const balanceBefore = await wallet.getBalance()

      const buyRequest = getDefaultLimitOrderBuy(weth, token, wallet)
      const wethAmount = 1000
      const excess = 1234
      buyRequest.amountInMax = BigNumber.from(wethAmount)
      const value = gasPrice.mul(buyRequest.gasLimit).mul(2).add(wethAmount)
      buyRequest.wrapUnwrap = true

      const tx = await limitOrder.buy(buyRequest, 11, 10, {
        ...overrides,
        value: value.add(excess),
      })

      const { gasUsed, effectiveGasPrice } = await tx.wait()

      const order = await limitOrder.getOrder(await limitOrder.newestOrderId())
      expect(order.status).to.eq(LimitOrderStatus.Waiting)

      const balanceAfter = await wallet.getBalance()
      expect(balanceBefore.sub(balanceAfter).sub(gasUsed.mul(effectiveGasPrice))).to.eq(
        gasPrice.mul(buyRequest.gasLimit).mul(2).add(wethAmount)
      )
    })

    it('should revert when order enqueue is disabled for buy order', async () => {
      const { limitOrder, delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
      const gasPrice = await limitOrder.gasPrice()
      const buyRequest = getDefaultLimitOrderBuy(token1, token0, wallet)
      await limitOrder.approve(token1.address, MAX_UINT_256, delay.address)
      await limitOrder.setEnqueueDisabled(true)

      await token1.approve(limitOrder.address, constants.MaxUint256, overrides)

      await limitOrder.setTwapPrice(2)
      await expect(
        limitOrder.buy(buyRequest, 1, 10, {
          ...overrides,
          value: gasPrice.mul(buyRequest.gasLimit).mul(2),
        })
      ).to.revertedWith('TL61')
    })
  })
})
