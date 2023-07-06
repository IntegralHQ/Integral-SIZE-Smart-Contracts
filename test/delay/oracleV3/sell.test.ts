import { expect } from 'chai'
import { constants, BigNumber, utils } from 'ethers'
import { delayOracleV3Fixture } from '../../shared/fixtures'
import { getDefaultSell, getOrderDigest, getSellOrderData } from '../../shared/orders'
import { OrderInternalType } from '../../shared/OrderType'
import { setupFixtureLoader } from '../../shared/setup'
import { overrides } from '../../shared/utilities'

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
    const { delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const sellRequest = getDefaultSell(token0, token1, wallet)
    sellRequest.gasPrice = gasPrice

    await token0.approve(delay.address, constants.MaxUint256, overrides)

    const tx = await delay.sell(sellRequest, {
      ...overrides,
      value: gasPrice.mul(sellRequest.gasLimit),
    })
    const receipt = await tx.wait()
    const orderData = getSellOrderData(receipt)
    const { timestamp } = await wallet.provider.getBlock(receipt.blockHash)

    const newestOrderId = await delay.newestOrderId()
    const orderHashOnChain = await delay.getOrderHash(newestOrderId, overrides)
    const orderHash = getOrderDigest(orderData[0])

    expect(orderHash).to.be.eq(orderHashOnChain)
    expect(orderData[0].orderType).to.equal(OrderInternalType.SELL_TYPE)
    expect(orderData[0].validAfterTimestamp).to.equal((await delay.delay()).add(timestamp))
  })

  it('enqueues an inverted order', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const sellRequest = getDefaultSell(token1, token0, wallet)
    await delay.setGasPrice(0, overrides)

    await token1.approve(delay.address, constants.MaxUint256, overrides)
    const tx = await delay.sell(sellRequest, overrides)

    const receipt = await tx.wait()
    const orderData = getSellOrderData(receipt)

    const newestOrderId = await delay.newestOrderId()
    const orderHashOnChain = await delay.getOrderHash(newestOrderId, overrides)
    const orderHash = getOrderDigest(orderData[0])

    expect(orderHash).to.be.eq(orderHashOnChain)
    expect(orderData[0].orderType).to.equal(OrderInternalType.SELL_INVERTED_TYPE)
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
