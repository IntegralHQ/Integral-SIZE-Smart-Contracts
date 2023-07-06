import { expect } from 'chai'
import { constants, BigNumber, utils } from 'ethers'
import { delayFixture, delayWithMaxTokenSupplyFixture } from '../shared/fixtures'
import { getBuyOrderData, getDefaultBuy, getOrderDigest } from '../shared/orders'
import { OrderInternalType, OrderType } from '../shared/OrderType'
import { setupFixtureLoader } from '../shared/setup'
import { INVALID_ADDRESS, overrides } from '../shared/utilities'

describe('TwapDelay.buy', () => {
  const loadFixture = setupFixtureLoader()

  describe('checks', () => {
    it('accounts for weth being used', async () => {
      const { delay, token, weth, wallet } = await loadFixture(delayFixture)

      const gasLimit = 10000
      const gasPrice = 100
      await delay.setGasPrice(gasPrice)

      const buyRequest = getDefaultBuy(weth, token, wallet)
      buyRequest.amountInMax = BigNumber.from(100)
      buyRequest.wrapUnwrap = true

      await expect(
        delay.buy(buyRequest, {
          ...overrides,
          value: gasLimit * gasPrice,
        })
      ).to.revertedWith('OS1E')
    })

    it('reverts when token transfer cost is unset', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const buyRequest = getDefaultBuy(token0, token1, wallet)
      buyRequest.tokenIn = INVALID_ADDRESS
      await expect(delay.buy(buyRequest, overrides)).to.revertedWith('OS0F')
    })

    it('fails if the deadline is exceeded', async () => {
      const { delay, token0, token1, wallet, provider } = await loadFixture(delayFixture)
      const buyRequest = getDefaultBuy(token0, token1, wallet)
      buyRequest.submitDeadline = await provider.getBlockNumber()

      await expect(delay.buy(buyRequest, overrides)).to.revertedWith('OS04')
    })

    it('reverts when amountOut is zero', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const buyRequest = getDefaultBuy(token0, token1, wallet)
      buyRequest.amountOut = BigNumber.from(0)

      await expect(delay.buy(buyRequest, overrides)).to.revertedWith('OS23')
    })

    it('reverts when address to is not set', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const buyRequest = getDefaultBuy(token0, token1, wallet)
      buyRequest.to = constants.AddressZero

      await expect(delay.buy(buyRequest, overrides)).to.revertedWith('OS26')
    })

    it('reverts when gasLimit is lower than minimum', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const buyRequest = getDefaultBuy(token0, token1, wallet)
      buyRequest.gasLimit = 999

      await expect(delay.buy(buyRequest, overrides)).to.revertedWith('OS3D')
    })

    it('reverts when gasLimit is higher than maximum', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const buyRequest = getDefaultBuy(token0, token1, wallet)
      buyRequest.gasLimit = 160001

      await delay.setMaxGasLimit(160000)
      await expect(delay.buy(buyRequest, overrides)).to.revertedWith('OS3E')
    })

    it('reverts when pair does not exist', async () => {
      const { delay, token0, token, wallet } = await loadFixture(delayFixture)
      const buyRequest = getDefaultBuy(token, token0, wallet)

      await expect(delay.buy(buyRequest, overrides)).to.revertedWith('OS17')
    })

    it('reverts when no ether was sent', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const buyRequest = getDefaultBuy(token0, token1, wallet)

      await delay.setGasPrice(100)
      await expect(delay.buy(buyRequest, overrides)).to.revertedWith('OS1E')
    })

    it('reverts when not enough ether was sent', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const buyRequest = getDefaultBuy(token0, token1, wallet)

      const gasPrice = 100
      await delay.setGasPrice(gasPrice)
      await expect(
        delay.buy(buyRequest, {
          ...overrides,
          value: buyRequest.gasLimit * gasPrice - 1,
        })
      ).to.revertedWith('OS1E')
    })

    it('reverts when buy is disabled', async () => {
      const { delay, token0, token1, wallet, pair } = await loadFixture(delayFixture)
      await delay.setOrderDisabled(pair.address, OrderType.Buy, true)
      const buyRequest = getDefaultBuy(token0, token1, wallet)
      await expect(delay.buy(buyRequest, overrides)).to.revertedWith('OS49')

      await delay.setOrderDisabled(pair.address, OrderType.Buy, false)
      await expect(delay.buy(buyRequest, overrides)).to.revertedWith('OS1E')
    })
  })

  it('refunds excess value', async () => {
    const { delay, token, weth, wallet } = await loadFixture(delayFixture)

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice)

    await token.approve(delay.address, constants.MaxUint256, overrides)

    const balanceBefore = await wallet.getBalance()

    const buyRequest = getDefaultBuy(weth, token, wallet)
    const wethAmount = 1000
    const excess = 1234
    buyRequest.amountInMax = BigNumber.from(wethAmount)
    const value = gasPrice.mul(buyRequest.gasLimit).add(wethAmount)
    buyRequest.wrapUnwrap = true

    const tx = await delay.buy(buyRequest, {
      ...overrides,
      value: value.add(excess),
    })

    const { gasUsed, effectiveGasPrice } = await tx.wait()

    const balanceAfter = await wallet.getBalance()
    expect(balanceBefore.sub(balanceAfter).sub(gasUsed.mul(effectiveGasPrice))).to.equal(value)
    expect(await wallet.provider.getBalance(delay.address)).to.eq(value.sub(wethAmount))
  })

  it('enqueues an order', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
    const gasPrice = await delay.gasPrice()
    const buyRequest = getDefaultBuy(token0, token1, wallet)

    await token0.approve(delay.address, constants.MaxUint256, overrides)
    const tx = await delay.buy(buyRequest, {
      ...overrides,
      value: gasPrice.mul(buyRequest.gasLimit),
    })

    const receipt = await tx.wait()
    const orderData = getBuyOrderData(receipt)
    const { timestamp } = await wallet.provider.getBlock(receipt.blockHash)
    const newestOrderId = await delay.newestOrderId()
    const orderHashOnChain = await delay.getOrderHash(newestOrderId, overrides)
    const orderHash = getOrderDigest(orderData[0])

    expect(orderHash).to.be.eq(orderHashOnChain)
    expect(orderData[0].orderType).to.equal(OrderInternalType.BUY_TYPE)
    expect(orderData[0].validAfterTimestamp).to.equal((await delay.delay()).add(timestamp))
  })

  it('reverts due to amountIn is too big (with balance)', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayWithMaxTokenSupplyFixture)
    const gasPrice = await delay.gasPrice()
    const buyRequest = getDefaultBuy(token0, token1, wallet)
    buyRequest.amountInMax = BigNumber.from('340282366920938463463374607431768211456')

    await token0.approve(delay.address, constants.MaxUint256, overrides)
    await token0.transfer(delay.address, 1)

    await expect(
      delay.buy(buyRequest, {
        ...overrides,
        value: gasPrice.mul(buyRequest.gasLimit),
      })
    ).to.be.revertedWith('TS73')
  })

  it('reverts due to amountIn is too big (with very large balance)', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayWithMaxTokenSupplyFixture)
    const gasPrice = await delay.gasPrice()
    const buyRequest = getDefaultBuy(token0, token1, wallet)
    buyRequest.amountInMax = BigNumber.from('340282366920938463463374607431768211456')

    await token0.approve(delay.address, constants.MaxUint256, overrides)
    await token0.transfer(delay.address, BigNumber.from('340282366920938463463374607431768211456'))

    await expect(
      delay.buy(buyRequest, {
        ...overrides,
        value: gasPrice.mul(buyRequest.gasLimit),
      })
    ).to.be.revertedWith('SM2A')
  })

  it('reverts due to amountIn is too big (without balance)', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayWithMaxTokenSupplyFixture)
    const gasPrice = await delay.gasPrice()
    const buyRequest = getDefaultBuy(token0, token1, wallet)
    buyRequest.amountInMax = BigNumber.from('340282366920938463463374607431768211456')

    await token0.approve(delay.address, constants.MaxUint256, overrides)

    await expect(
      delay.buy(buyRequest, {
        ...overrides,
        value: gasPrice.mul(buyRequest.gasLimit),
      })
    ).to.be.revertedWith('TS73')
  })

  it('enqueues an inverted order', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
    await delay.setGasPrice(0)
    const buyRequest = getDefaultBuy(token1, token0, wallet)

    await token1.approve(delay.address, constants.MaxUint256, overrides)
    const tx = await delay.buy(buyRequest, overrides)
    const receipt = await tx.wait()

    const orderData = getBuyOrderData(receipt)
    const orderHashOnChain = await delay.getOrderHash(await delay.newestOrderId(), overrides)
    const orderHash = getOrderDigest(orderData[0])

    expect(orderHash).to.be.eq(orderHashOnChain)
    expect(orderData[0].orderType).to.equal(OrderInternalType.BUY_INVERTED_TYPE)
  })

  it('returns orderId', async () => {
    const { delay, orderIdTest, token0, token1, wallet } = await loadFixture(delayFixture)
    const gasPrice = await delay.gasPrice()
    const buyRequest = getDefaultBuy(token0, token1, wallet)

    await token0.transfer(orderIdTest.address, utils.parseEther('10'), overrides)
    await orderIdTest.approve(token0.address, delay.address, constants.MaxUint256, overrides)

    await expect(
      orderIdTest.buy(buyRequest, {
        ...overrides,
        value: gasPrice.mul(buyRequest.gasLimit),
      })
    )
      .to.emit(orderIdTest, 'OrderId')
      .withArgs(1)
  })
})
