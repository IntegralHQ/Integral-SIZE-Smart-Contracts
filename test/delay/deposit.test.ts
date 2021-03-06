import { expect } from 'chai'
import { constants, BigNumber, utils } from 'ethers'
import { delayFixture } from '../shared/fixtures'
import { OrderType } from '../shared/OrderType'
import { setupFixtureLoader } from '../shared/setup'
import { INVALID_ADDRESS, overrides, pairAddressToPairId } from '../shared/utilities'
import { getDefaultDeposit, sortTokens, depositAndWait } from '../shared/orders'

describe('TwapDelay.deposit', () => {
  const loadFixture = setupFixtureLoader()

  describe('checks', () => {
    it('reverts when token transfer cost is unset', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const depositRequest = getDefaultDeposit(token0, token1, wallet)
      depositRequest.token0 = INVALID_ADDRESS
      await expect(delay.deposit(depositRequest, overrides)).to.revertedWith('OS0F')
    })

    it('reverts when both token amounts are zero', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const depositRequest = getDefaultDeposit(token0, token1, wallet)
      depositRequest.amount0 = BigNumber.from(0)
      depositRequest.amount1 = BigNumber.from(0)

      await expect(delay.deposit(depositRequest, overrides)).to.revertedWith('OS25')
    })

    it('reverts when address to is not set', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const depositRequest = getDefaultDeposit(token0, token1, wallet)
      depositRequest.to = constants.AddressZero

      await expect(delay.deposit(depositRequest, overrides)).to.revertedWith('OS26')
    })

    it('reverts when gasLimit is lower than minimum', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const depositRequest = getDefaultDeposit(token0, token1, wallet)
      depositRequest.gasLimit = 999

      await expect(delay.deposit(depositRequest, overrides)).to.revertedWith('OS3D')
    })

    it('reverts when gasLimit is higher than maximum', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const depositRequest = getDefaultDeposit(token0, token1, wallet)
      depositRequest.gasLimit = 160001

      await delay.setMaxGasLimit(160000)
      await expect(delay.deposit(depositRequest, overrides)).to.revertedWith('OS3E')
    })

    it('reverts when pair does not exist', async () => {
      const { delay, token0, token, wallet } = await loadFixture(delayFixture)
      const depositRequest = getDefaultDeposit(token, token0, wallet)

      await expect(delay.deposit(depositRequest, overrides)).to.revertedWith('OS17')
    })

    it('reverts when no ether was sent', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const depositRequest = getDefaultDeposit(token0, token1, wallet)

      await delay.setGasPrice(100)
      await expect(delay.deposit(depositRequest, overrides)).to.revertedWith('OS1E')
    })

    it('reverts when not enough ether was sent', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const depositRequest = getDefaultDeposit(token0, token1, wallet)

      const gasPrice = 100
      await delay.setGasPrice(gasPrice, overrides)
      await expect(
        delay.deposit(depositRequest, {
          ...overrides,
          value: depositRequest.gasLimit * gasPrice - 1,
        })
      ).to.revertedWith('OS1E')
    })

    it('accounts for weth being used', async () => {
      const { delay, token, weth, wallet } = await loadFixture(delayFixture)

      const gasLimit = 10000
      const gasPrice = 100
      await delay.setGasPrice(gasPrice, overrides)

      const [token0, token1] = sortTokens(token, weth)
      const depositRequest = getDefaultDeposit(token0, token1, wallet)
      depositRequest.amount0 = BigNumber.from(100)
      depositRequest.amount1 = BigNumber.from(100)
      depositRequest.wrap = true

      await expect(
        delay.deposit(depositRequest, {
          ...overrides,
          value: gasLimit * gasPrice,
        })
      ).to.revertedWith('OS1E')
    })

    it('fails if the deadline is exceeded', async () => {
      const { delay, token0, token1, wallet, provider } = await loadFixture(delayFixture)
      const depositRequest = getDefaultDeposit(token0, token1, wallet)
      depositRequest.submitDeadline = await provider.getBlockNumber()

      await expect(delay.deposit(depositRequest, overrides)).to.revertedWith('OS04')
    })

    it('reverts when deposit is disabled', async () => {
      const { delay, token0, token1, wallet, pair } = await loadFixture(delayFixture)
      await delay.setOrderDisabled(pair.address, OrderType.Deposit, true, overrides)
      const depositRequest = getDefaultDeposit(token0, token1, wallet)
      await expect(delay.deposit(depositRequest, overrides)).to.revertedWith('OS46')

      await delay.setOrderDisabled(pair.address, OrderType.Deposit, false)
      await expect(delay.deposit(depositRequest, overrides)).to.revertedWith('OS1E')
    })
  })

  it('refunds excess value', async () => {
    const { delay, token, weth, wallet } = await loadFixture(delayFixture)

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
    const { delay, token0, token1, wallet, pair } = await loadFixture(delayFixture)

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
    const { timestamp } = await wallet.provider.getBlock((await tx.wait()).blockHash)

    const newestOrderId = await delay.newestOrderId()
    const { orderType, validAfterTimestamp } = await delay.getOrder(newestOrderId)
    const result = await delay.getDepositOrder(newestOrderId)

    expect(orderType).to.equal(OrderType.Deposit)
    expect(validAfterTimestamp).to.equal((await delay.delay()) + timestamp)

    expect([...result]).to.deep.equal([
      pairAddressToPairId(pair.address),
      depositRequest.amount0,
      depositRequest.amount1,
      depositRequest.minSwapPrice,
      depositRequest.maxSwapPrice,
      depositRequest.wrap,
      depositRequest.swap,
      wallet.address,
      BigNumber.from(depositRequest.gasPrice),
      BigNumber.from(depositRequest.gasLimit),
      validAfterTimestamp,
      result.priceAccumulator,
      result.timestamp,
    ])
  })

  it('enqueues an order with reverse tokens', async () => {
    const { delay, token0, token1, wallet, pair } = await loadFixture(delayFixture)

    const depositRequest = await depositAndWait(delay, token1, token0, wallet)
    const result = await delay.getDepositOrder(await delay.newestOrderId())

    expect([...result]).to.deep.equal([
      pairAddressToPairId(pair.address),
      // because we swapped before this is actually 0 and 1, not 1 and 0
      depositRequest.amount1,
      depositRequest.amount0,
      depositRequest.minSwapPrice,
      depositRequest.maxSwapPrice,
      depositRequest.wrap,
      depositRequest.swap,
      wallet.address,
      BigNumber.from(depositRequest.gasPrice),
      BigNumber.from(depositRequest.gasLimit),
      result.validAfterTimestamp,
      result.priceAccumulator,
      result.timestamp,
    ])
  })

  it('returns orderId', async () => {
    const { delay, orderIdTest, token0, token1, wallet } = await loadFixture(delayFixture)
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
