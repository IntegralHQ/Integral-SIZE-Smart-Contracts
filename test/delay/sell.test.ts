import { expect } from 'chai'
import { constants, BigNumber, utils } from 'ethers'
import { delayFixture } from '../shared/fixtures'
import { getDefaultSell } from '../shared/orders'
import { OrderType } from '../shared/OrderType'
import { setupFixtureLoader } from '../shared/setup'
import { INVALID_ADDRESS, overrides, pairAddressToPairId } from '../shared/utilities'

describe('TwapDelay.sell', () => {
  const loadFixture = setupFixtureLoader()

  describe('checks', () => {
    it('accounts for weth being used', async () => {
      const { delay, token, weth, wallet } = await loadFixture(delayFixture)

      const gasLimit = 10000
      const gasPrice = 100
      await delay.setGasPrice(gasPrice)

      const sellRequest = getDefaultSell(weth, token, wallet)
      sellRequest.amountIn = BigNumber.from(100)
      sellRequest.wrapUnwrap = true

      await expect(
        delay.sell(sellRequest, {
          ...overrides,
          value: gasLimit * gasPrice,
        })
      ).to.revertedWith('OS1E')
    })

    it('reverts when token transfer cost is unset', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const sellRequest = getDefaultSell(token0, token1, wallet)
      sellRequest.tokenIn = INVALID_ADDRESS
      await expect(delay.sell(sellRequest, overrides)).to.revertedWith('OS0F')
    })

    it('fails if the deadline is exceeded', async () => {
      const { delay, token0, token1, wallet, provider } = await loadFixture(delayFixture)
      const sellRequest = getDefaultSell(token0, token1, wallet)
      sellRequest.submitDeadline = await provider.getBlockNumber()

      await expect(delay.sell(sellRequest, overrides)).to.revertedWith('OS04')
    })

    it('reverts when amountIn is zero', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const sellRequest = getDefaultSell(token0, token1, wallet)
      sellRequest.amountIn = BigNumber.from(0)

      await expect(delay.sell(sellRequest, overrides)).to.revertedWith('OS24')
    })

    it('reverts when address to is not set', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const sellRequest = getDefaultSell(token0, token1, wallet)
      sellRequest.to = constants.AddressZero

      await expect(delay.sell(sellRequest, overrides)).to.revertedWith('OS26')
    })

    it('reverts when gasLimit is lower than minimum', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const sellRequest = getDefaultSell(token0, token1, wallet)
      sellRequest.gasLimit = 999

      await expect(delay.sell(sellRequest, overrides)).to.revertedWith('OS3D')
    })

    it('reverts when gasLimit is higher than maximum', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const sellRequest = getDefaultSell(token0, token1, wallet)
      sellRequest.gasLimit = 160001

      await delay.setMaxGasLimit(160000)
      await expect(delay.sell(sellRequest, overrides)).to.revertedWith('OS3E')
    })

    it('reverts when pair does not exist', async () => {
      const { delay, token0, token, wallet } = await loadFixture(delayFixture)
      const sellRequest = getDefaultSell(token, token0, wallet)

      await expect(delay.sell(sellRequest, overrides)).to.revertedWith('OS17')
    })

    it('reverts when no ether was sent', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const sellRequest = getDefaultSell(token0, token1, wallet)

      await delay.setGasPrice(100)
      await expect(delay.sell(sellRequest, overrides)).to.revertedWith('OS1E')
    })

    it('reverts when not enough ether was sent', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const sellRequest = getDefaultSell(token0, token1, wallet)

      const gasPrice = 100
      await delay.setGasPrice(gasPrice)
      await expect(
        delay.sell(sellRequest, {
          ...overrides,
          value: sellRequest.gasLimit * gasPrice - 1,
        })
      ).to.revertedWith('OS1E')
    })

    it('reverts when sell is disabled', async () => {
      const { delay, token0, token1, wallet, pair } = await loadFixture(delayFixture)
      await delay.setOrderDisabled(pair.address, OrderType.Sell, true, overrides)
      const sellRequest = getDefaultSell(token0, token1, wallet)
      await expect(delay.sell(sellRequest, overrides)).to.revertedWith('OS13')

      await delay.setOrderDisabled(pair.address, OrderType.Sell, false)
      await expect(delay.sell(sellRequest, overrides)).to.revertedWith('OS1E')
    })
  })

  it('refunds excess value', async () => {
    const { delay, token, weth, wallet } = await loadFixture(delayFixture)

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
    const { delay, token0, token1, wallet, pair } = await loadFixture(delayFixture)

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
    const { delay, token0, token1, wallet, pair } = await loadFixture(delayFixture)
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
    const { delay, orderIdTest, token0, token1, wallet } = await loadFixture(delayFixture)
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
