import { expect } from 'chai'
import { constants, BigNumber, utils } from 'ethers'
import { delayOracleV3Fixture } from '../../shared/fixtures'
import { OrderInternalType } from '../../shared/OrderType'
import { setupFixtureLoader } from '../../shared/setup'
import { overrides } from '../../shared/utilities'
import { getDefaultDeposit, sortTokens, depositAndWait, getDepositOrderData, getOrderDigest } from '../../shared/orders'

describe('TwapDelay.deposit.oracleV3', () => {
  const loadFixture = setupFixtureLoader()

  it('refunds excess value', async () => {
    const { delay, token, weth, wallet } = await loadFixture(delayOracleV3Fixture)

    const gasPrice = utils.parseUnits('100', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    await token.approve(delay.address, constants.MaxUint256, overrides)

    const balanceBefore = await wallet.getBalance()

    const [token0, token1] = sortTokens(token, weth)
    const depositRequest = getDefaultDeposit(token0, token1, wallet)
    const wethAmount = 1000
    const excess = 1234
    depositRequest.amount0 = BigNumber.from(wethAmount)
    depositRequest.amount1 = BigNumber.from(wethAmount)
    const value = gasPrice.mul(depositRequest.gasLimit).add(wethAmount)
    depositRequest.wrap = true

    const tx = await delay.deposit(depositRequest, {
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
    await delay.setGasPrice(gasPrice)

    const depositRequest = getDefaultDeposit(token0, token1, wallet)
    depositRequest.gasPrice = gasPrice

    await token0.approve(delay.address, constants.MaxUint256, overrides)
    await token1.approve(delay.address, constants.MaxUint256, overrides)

    const tx = await delay.deposit(depositRequest, {
      ...overrides,
      value: BigNumber.from(depositRequest.gasLimit).mul(gasPrice),
    })
    const receipt = await tx.wait()
    const orderData = getDepositOrderData(receipt)
    const { timestamp } = await wallet.provider.getBlock(receipt.blockHash)

    const newestOrderId = await delay.newestOrderId()
    const orderHashOnChain = await delay.getOrderHash(newestOrderId, overrides)
    const orderHash = getOrderDigest(orderData[0])

    expect(orderHash).to.be.eq(orderHashOnChain)
    expect(orderData[0].orderType).to.equal(OrderInternalType.DEPOSIT_TYPE)
    expect(orderData[0].validAfterTimestamp).to.equal((await delay.delay()).add(timestamp))
  })

  it('enqueues an order with reverse tokens', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)

    const depositRequest = await depositAndWait(delay, token1, token0, wallet)
    const newestOrderId = await delay.newestOrderId()
    const orderHashOnChain = await delay.getOrderHash(newestOrderId, overrides)
    const orderHash = getOrderDigest(depositRequest.orderData[0])

    expect(orderHash).to.be.eq(orderHashOnChain)
  })

  it('returns orderId', async () => {
    const { delay, orderIdTest, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)
    const gasPrice = await delay.gasPrice()
    const depositRequest = getDefaultDeposit(token0, token1, wallet)

    await token0.transfer(orderIdTest.address, utils.parseEther('10'), overrides)
    await token1.transfer(orderIdTest.address, utils.parseEther('10'), overrides)
    await orderIdTest.approve(token0.address, delay.address, constants.MaxUint256, overrides)
    await orderIdTest.approve(token1.address, delay.address, constants.MaxUint256, overrides)

    await expect(
      orderIdTest.deposit(depositRequest, {
        ...overrides,
        value: gasPrice.mul(depositRequest.gasLimit),
      })
    )
      .to.emit(orderIdTest, 'OrderId')
      .withArgs(1)
  })
})
