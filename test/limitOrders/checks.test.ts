import { expect } from 'chai'
import { delayOracleV3Fixture } from '../shared/fixtures'
import { getDefaultLimitOrderBuy, getDefaultSell } from '../shared/orders'
import { setupFixtureLoader } from '../shared/setup'
import { MAX_UINT_32, overrides } from '../shared/utilities'
import { BigNumber, constants } from 'ethers'

describe('TwapLimitOrder.check', () => {
  const loadFixture = setupFixtureLoader()
  describe('checks', () => {
    it('reverts when token transfer cost is unset', async () => {
      const { limitOrder, delay, token, wallet, weth } = await loadFixture(delayOracleV3Fixture)

      const gasLimit = 10000
      const gasPrice = 100
      await delay.setGasPrice(gasPrice)

      const buyRequest = getDefaultLimitOrderBuy(weth, token, wallet)
      buyRequest.amountInMax = BigNumber.from(100)
      buyRequest.wrapUnwrap = true

      await limitOrder.setTwapPrice(10)

      await expect(
        limitOrder.buy(buyRequest, 100, 10, {
          ...overrides,
          value: gasLimit * gasPrice,
        })
      ).to.revertedWith('TL1E')
    })

    it('reverts when amountOut is zero', async () => {
      const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
      const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
      buyRequest.amountOut = BigNumber.from(0)

      await limitOrder.setTwapPrice(10)
      await expect(limitOrder.buy(buyRequest, 10, 10, overrides)).to.revertedWith('TL23')
    })

    it('reverts when address to is not set', async () => {
      const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
      const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
      buyRequest.to = constants.AddressZero

      await limitOrder.setTwapPrice(10)
      await expect(limitOrder.buy(buyRequest, 10, 10, overrides)).to.revertedWith('TL26')
    })

    it('reverts when gasLimit is lower than minimum', async () => {
      const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
      const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
      buyRequest.gasLimit = 999

      await limitOrder.setTwapPrice(10)
      await expect(limitOrder.buy(buyRequest, 10, 10, overrides)).to.revertedWith('TL3D')
    })
    it('reverts when gasLimit is higher than maximum', async () => {
      const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
      const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
      buyRequest.gasLimit = 160001

      await limitOrder.setMaxGasLimit(160000)
      await limitOrder.setTwapPrice(10)
      await expect(limitOrder.buy(buyRequest, 10, 10, overrides)).to.revertedWith('TL3E')
    })

    it('reverts when pair does not exist', async () => {
      const { limitOrder, token0, wallet } = await loadFixture(delayOracleV3Fixture)
      const buyRequest = getDefaultLimitOrderBuy(token0, token0, wallet)

      await expect(limitOrder.buy(buyRequest, 10, 10, overrides)).to.revertedWith('TL17')
    })

    it('reverts when no ether was sent', async () => {
      const { limitOrder, delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
      const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)

      await delay.setGasPrice(100)
      await limitOrder.setTwapPrice(10)
      await expect(limitOrder.buy(buyRequest, 10, 10, overrides)).to.revertedWith('TL1E')
    })

    it('reverts when not enough ether was sent', async () => {
      const { limitOrder, delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
      const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)

      const gasPrice = 100
      await delay.setGasPrice(gasPrice)
      await limitOrder.setTwapPrice(10)
      await expect(
        limitOrder.buy(buyRequest, 10, 10, {
          ...overrides,
          value: buyRequest.gasLimit * gasPrice,
        })
      ).to.revertedWith('TL1E')
    })

    it('reverts when buy order submitDeadline is too big', async () => {
      const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
      const gasPrice = await limitOrder.gasPrice()
      const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
      await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

      await limitOrder.setTwapPrice(10)
      buyRequest.submitDeadline = MAX_UINT_32
      await expect(
        limitOrder.buy(buyRequest, 1, 10, {
          ...overrides,
          value: gasPrice.mul(buyRequest.gasLimit).mul(2),
        })
      ).to.revertedWith('TL54')
    })

    it('reverts when sell order submitDeadline is too big', async () => {
      const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
      const gasPrice = await limitOrder.gasPrice()
      const sellRequest = getDefaultSell(token0, token1, wallet)
      await token0.approve(limitOrder.address, constants.MaxUint256, overrides)

      await limitOrder.setTwapPrice(10)
      sellRequest.submitDeadline = MAX_UINT_32
      await expect(
        limitOrder.sell(sellRequest, 1, 10, {
          ...overrides,
          value: gasPrice.mul(sellRequest.gasLimit).mul(2),
        })
      ).to.revertedWith('TL54')
    })
  })
})
