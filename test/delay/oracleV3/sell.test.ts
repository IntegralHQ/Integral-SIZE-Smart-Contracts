import { expect } from 'chai'
import { constants, BigNumber, utils } from 'ethers'
import { delayOracleV3Fixture } from '../../shared/fixtures'
import { getDefaultSell } from '../../shared/orders'
import { OrderType } from '../../shared/OrderType'
import { setupFixtureLoader } from '../../shared/setup'
import { overrides, pairAddressToPairId } from '../../shared/utilities'

describe('TwapDelay.sell.oracleV3', () => {
  const loadFixture = setupFixtureLoader()

  it('refunds excess value', async () => {
    const { delay, token, weth, wallet } = await loadFixture(delayOracleV3Fixture)

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    await token.approve(delay.address, constants.MaxUint256, overrides)

    const balanceBefore = await wallet.getBalance()

    const sellRequest = getDefaultSell(weth, token, wallet)
    const wethAmount = 1000
    const excess = 1234
    sellRequest.amountIn = BigNumber.from(wethAmount)
    const value = gasPrice.mul(sellRequest.gasLimit).add(wethAmount)
    sellRequest.wrapUnwrap = true

    const tx = await delay.sell(sellRequest, {
      ...overrides,
      value: value.add(excess),
    })

    const { gasUsed, effectiveGasPrice } = await tx.wait()

    const balanceAfter = await wallet.getBalance()
    expect(balanceBefore.sub(balanceAfter).sub(gasUsed.mul(effectiveGasPrice))).to.equal(value)
    expect(await wallet.provider.getBalance(delay.address)).to.eq(value.sub(wethAmount))
  })

  it('enqueues an order', async () => {
    const { delay, token0, token1, wallet, pair } = await loadFixture(delayOracleV3Fixture)

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const sellRequest = getDefaultSell(token0, token1, wallet)
    sellRequest.gasPrice = gasPrice

    await token0.approve(delay.address, constants.MaxUint256, overrides)

    const tx = await delay.sell(sellRequest, {
      ...overrides,
      value: gasPrice.mul(sellRequest.gasLimit),
    })
    const { timestamp } = await wallet.provider.getBlock((await tx.wait()).blockHash)

    const newestOrderId = await delay.newestOrderId()
    const { orderType } = await delay.getOrder(newestOrderId)
    const { validAfterTimestamp, priceAccumulator, timestamp: orderTimestamp } = await delay.getSellOrder(newestOrderId)
    const result = await delay.getSellOrder(newestOrderId)

    expect(orderType).to.equal(OrderType.Sell)
    expect(validAfterTimestamp).to.equal((await delay.delay()) + timestamp)

    expect([...result]).to.deep.equal([
      pairAddressToPairId(pair.address),
      false,
      sellRequest.amountIn,
      sellRequest.amountOutMin,
      sellRequest.wrapUnwrap,
      sellRequest.to,
      BigNumber.from(sellRequest.gasPrice),
      BigNumber.from(sellRequest.gasLimit),
      validAfterTimestamp,
      priceAccumulator,
      orderTimestamp,
    ])
  })

  it('enqueues an inverted order', async () => {
    const { delay, token0, token1, wallet, pair } = await loadFixture(delayOracleV3Fixture)
    const sellRequest = getDefaultSell(token1, token0, wallet)
    await delay.setGasPrice(0, overrides)

    await token1.approve(delay.address, constants.MaxUint256, overrides)
    await delay.sell(sellRequest, overrides)

    const result = await delay.getSellOrder(await delay.newestOrderId())
    expect([...result]).to.deep.equal([
      pairAddressToPairId(pair.address),
      true,
      sellRequest.amountIn,
      sellRequest.amountOutMin,
      sellRequest.wrapUnwrap,
      sellRequest.to,
      BigNumber.from(0),
      BigNumber.from(sellRequest.gasLimit),
      result.validAfterTimestamp,
      result.priceAccumulator,
      result.timestamp,
    ])
  })

  it('returns orderId', async () => {
    const { delay, orderIdTest, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await delay.gasPrice()
    const sellRequest = getDefaultSell(token0, token1, wallet)

    await token0.transfer(orderIdTest.address, utils.parseEther('10'), overrides)
    await orderIdTest.approve(token0.address, delay.address, constants.MaxUint256, overrides)

    await expect(
      orderIdTest.sell(sellRequest, {
        ...overrides,
        value: gasPrice.mul(sellRequest.gasLimit),
      })
    )
      .to.emit(orderIdTest, 'OrderId')
      .withArgs(1)
  })
})
