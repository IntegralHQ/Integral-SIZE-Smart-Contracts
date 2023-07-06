import { setupFixtureLoader } from '../shared/setup'
import { delayOracleV3Fixture } from '../shared/fixtures'
import { getDefaultLimitOrderBuy, getDefaultLimitOrderSell } from '../shared/orders'
import { mineBlock, overrides } from '../shared/utilities'
import { expect } from 'chai'
import { providers, constants } from 'ethers'

describe('TwapLimitOrder.twapInterval', () => {
  const loadFixture = setupFixtureLoader()
  it('reverts when buy order twapInterval is zero', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await expect(
      limitOrder.buy(buyRequest, 1, 0, {
        ...overrides,
        value: gasPrice.mul(buyRequest.gasLimit).mul(2),
      })
    ).to.revertedWith('TL56')
  })

  it('reverts when buy order twapInterval is too big', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)

    const gasPrice = await limitOrder.gasPrice()
    const buyRequest = getDefaultLimitOrderBuy(token0, token1, wallet)
    await (limitOrder.provider as providers.JsonRpcProvider).send('evm_increaseTime', [30 * 60 + 1])

    await expect(
      limitOrder.buy(buyRequest, 1, 100000, {
        ...overrides,
        value: gasPrice.mul(buyRequest.gasLimit).mul(2),
      })
    ).to.revertedWith('TL66')
  })

  it('reverts when sell order twapInterval is zero', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await limitOrder.gasPrice()
    const sellRequest = getDefaultLimitOrderSell(token0, token1, wallet)
    await expect(
      limitOrder.sell(sellRequest, 1, 0, {
        ...overrides,
        value: gasPrice.mul(sellRequest.gasLimit).mul(2),
      })
    ).to.revertedWith('TL56')
  })

  it('reverts when sell order twapInterval is too big', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)

    const gasPrice = await limitOrder.gasPrice()
    await (limitOrder.provider as providers.JsonRpcProvider).send('evm_increaseTime', [30 * 60 + 1])

    const sellRequest = getDefaultLimitOrderSell(token0, token1, wallet)
    await expect(
      limitOrder.sell(sellRequest, 1, 10000000, {
        ...overrides,
        value: gasPrice.mul(sellRequest.gasLimit).mul(2),
      })
    ).to.revertedWith('TL66')
  })

  it('reverts when sell order twapInterval cardinality is too small', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)

    const gasPrice = await limitOrder.gasPrice()
    await (limitOrder.provider as providers.JsonRpcProvider).send('evm_increaseTime', [30 * 60 + 1])

    await mineBlock(wallet)

    const sellRequest = getDefaultLimitOrderSell(token0, token1, wallet)
    await expect(
      limitOrder.sell(sellRequest, 1, 20, {
        ...overrides,
        value: gasPrice.mul(sellRequest.gasLimit).mul(2),
      })
    ).to.revertedWith('TL66')
  })

  it('reverts when sell order twapInterval cardinality is too small', async () => {
    const { limitOrder, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)

    await (limitOrder.provider as providers.JsonRpcProvider).send('evm_increaseTime', [30 * 60 + 1])

    await mineBlock(wallet)

    const gasPrice = await limitOrder.gasPrice()
    const sellRequest = getDefaultLimitOrderSell(token1, token0, wallet)

    await token1.approve(limitOrder.address, constants.MaxUint256, overrides)
    await limitOrder.setTwapPrice(11)
    await expect(
      limitOrder.sell(sellRequest, 1, 100, {
        ...overrides,
        value: gasPrice.mul(sellRequest.gasLimit).mul(2),
      })
    ).to.revertedWith('TL66')
  })
})
