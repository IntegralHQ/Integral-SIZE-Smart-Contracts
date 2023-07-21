import { expect } from 'chai'
import { constants, BigNumber, utils } from 'ethers'
import { delayFixture, delayWithMaxTokenSupplyFixture } from '../shared/fixtures'
import { getDefaultSell, getOrderDigest, getSellOrderData } from '../shared/orders'
import { OrderInternalType, OrderType } from '../shared/OrderType'
import { setupFixtureLoader } from '../shared/setup'
import { DELAY, INVALID_ADDRESS, expandTo18Decimals, getEventsFrom, increaseTime, overrides } from '../shared/utilities'

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

    it('reverts due to amountIn is too big (with balance)', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayWithMaxTokenSupplyFixture)
      const gasPrice = await delay.gasPrice()
      const sellRequest = getDefaultSell(token0, token1, wallet)
      sellRequest.amountIn = BigNumber.from('340282366920938463463374607431768211456')

      await token0.approve(delay.address, constants.MaxUint256, overrides)
      await token0.transfer(delay.address, 1)

      await expect(
        delay.sell(sellRequest, {
          ...overrides,
          value: gasPrice.mul(sellRequest.gasLimit),
        })
      ).to.be.revertedWith('TS73')
    })

    it('reverts due to amountIn is too big (with very large balance)', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayWithMaxTokenSupplyFixture)
      const gasPrice = await delay.gasPrice()
      const sellRequest = getDefaultSell(token0, token1, wallet)
      sellRequest.amountIn = BigNumber.from('340282366920938463463374607431768211456')

      await token0.approve(delay.address, constants.MaxUint256, overrides)
      await token0.transfer(delay.address, BigNumber.from('340282366920938463463374607431768211456'))

      await expect(
        delay.sell(sellRequest, {
          ...overrides,
          value: gasPrice.mul(sellRequest.gasLimit),
        })
      ).to.be.revertedWith('SM2A')
    })

    it('reverts due to amountIn is too big (without balance)', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayWithMaxTokenSupplyFixture)
      const gasPrice = await delay.gasPrice()
      const sellRequest = getDefaultSell(token0, token1, wallet)
      sellRequest.amountIn = BigNumber.from('340282366920938463463374607431768211456')

      await token0.approve(delay.address, constants.MaxUint256, overrides)

      await expect(
        delay.sell(sellRequest, {
          ...overrides,
          value: gasPrice.mul(sellRequest.gasLimit),
        })
      ).to.be.revertedWith('TS73')
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
    const { delay, token0, token1, wallet } = await loadFixture(delayFixture)

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
    const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
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

  it('share 0 exploit', async () => {
    const {
      factory,
      delay,
      pair,
      addLiquidity,
      token0,
      token1,
      wallet,
      other: hacker,
      another: victim,
    } = await loadFixture(delayFixture)
    await factory.setSwapFee(token0.address, token1.address, 0, overrides)
    await addLiquidity(expandTo18Decimals(3000), expandTo18Decimals(3000))
    await token0.transfer(hacker.address, expandTo18Decimals(30000), overrides)
    await token0.transfer(victim.address, expandTo18Decimals(30000), overrides)
    await token0.connect(hacker).approve(delay.address, constants.MaxUint256, overrides)
    await token0.connect(victim).approve(delay.address, constants.MaxUint256, overrides)
    const gasPrice = await delay.gasPrice()

    const sellRequestHacker = getDefaultSell(token0, token1, hacker)
    sellRequestHacker.amountIn = BigNumber.from(1)
    // sellRequestHacker.amountIn = BigNumber.from(expandTo18Decimals(1000))
    const txHacker = await delay
      .connect(hacker)
      .sell(sellRequestHacker, { ...overrides, value: gasPrice.mul(sellRequestHacker.gasLimit) })
    const receiptTxHacker = await txHacker.wait()
    const orderDataHacker = getSellOrderData(receiptTxHacker)

    const amountToSteal = expandTo18Decimals(1000)
    await token0.connect(hacker).transfer(delay.address, amountToSteal)

    const sellRequestVictim = getDefaultSell(token0, token1, victim)
    sellRequestVictim.amountIn = amountToSteal
    const txVictim = await delay
      .connect(victim)
      .sell(sellRequestVictim, { ...overrides, value: gasPrice.mul(sellRequestVictim.gasLimit) })
    const receiptTxVictim = await txVictim.wait()
    const orderDataVictim = getSellOrderData(receiptTxVictim)
    expect(BigNumber.from(orderDataVictim[0].value0).gt(0))

    const orderData = orderDataHacker.concat(orderDataVictim)
    await increaseTime(wallet, DELAY + 1)
    const tx = await delay.execute(orderData, overrides)

    const swapEvents = await getEventsFrom(pair, tx, 'Swap')
    const parsedSwapEvents = swapEvents.map((e) => pair.interface.parseLog({ topics: e.topics, data: e.data }))
    for (const event of parsedSwapEvents) {
      expect(event.args['amount0In'].mul(2)).to.eq(event.args['amount1Out'])
    }

    expect((await token1.balanceOf(victim.address)).gt(0))
  })
})
