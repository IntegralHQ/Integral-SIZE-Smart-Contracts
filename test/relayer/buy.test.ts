import { expect } from 'chai'
import { constants, BigNumber, utils } from 'ethers'
import { getDefaultRelayerBuy, relayerFixture } from '../shared/fixtures/relayerFixture'
import { getOrderDigest, getSellOrderData } from '../shared/orders'
import { OrderInternalType, OrderType } from '../shared/OrderType'
import { ceil_div } from '../shared/safeMath'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, overrides } from '../shared/utilities'

describe('TwapRelayer.buy', () => {
  const loadFixture = setupFixtureLoader()

  describe('checks', () => {
    it('accounts for weth being used', async () => {
      const { relayer, delay, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()

      const gasLimit = 10000
      const gasPrice = 100
      await delay.setGasPrice(gasPrice)

      const buyRequest = getDefaultRelayerBuy(weth, token, wallet)
      buyRequest.amountInMax = BigNumber.from(gasLimit * gasPrice + 1)
      buyRequest.wrapUnwrap = true

      await expect(
        relayer.buy(buyRequest, {
          ...overrides,
          value: gasLimit * gasPrice,
        })
      ).to.revertedWith('TR03')
    })

    it('reverts when twap interval not set', async () => {
      const { relayer, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping(false, true)
      const buyRequest = getDefaultRelayerBuy(token, weth, wallet)

      await expect(relayer.buy(buyRequest, overrides)).to.revertedWith('TR55')
    })

    it('fails if the deadline is exceeded', async () => {
      const { relayer, token, weth, wallet, provider, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()
      const buyRequest = getDefaultRelayerBuy(token, weth, wallet)
      buyRequest.submitDeadline = await provider.getBlockNumber()

      await expect(relayer.buy(buyRequest, overrides)).to.revertedWith('OS04')
    })

    it('reverts when amountOut is zero', async () => {
      const { relayer, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()
      const buyRequest = getDefaultRelayerBuy(token, weth, wallet)
      buyRequest.amountOut = BigNumber.from(0)

      await expect(relayer.buy(buyRequest, overrides)).to.revertedWith('OS24')
    })

    it('reverts when address to is not set', async () => {
      const { relayer, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()
      const buyRequest = getDefaultRelayerBuy(token, weth, wallet)
      buyRequest.to = constants.AddressZero

      await expect(relayer.buy(buyRequest, overrides)).to.revertedWith('TR26')
    })

    it('reverts when gasLimit is lower than minimum', async () => {
      const { relayer, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()
      await relayer.setExecutionGasLimit(999)
      const buyRequest = getDefaultRelayerBuy(token, weth, wallet)

      await expect(relayer.buy(buyRequest, overrides)).to.revertedWith('OS3D')
    })

    it('reverts when gasLimit is higher than maximum', async () => {
      const { relayer, delay, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()
      await relayer.setExecutionGasLimit(160001)
      const buyRequest = getDefaultRelayerBuy(token, weth, wallet)

      await delay.setMaxGasLimit(160000)
      await expect(relayer.buy(buyRequest, overrides)).to.revertedWith('OS3E')
    })

    it('reverts when pair does not exist', async () => {
      const { relayer, token0, token, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()
      const buyRequest = getDefaultRelayerBuy(token, token0, wallet)

      await expect(relayer.buy(buyRequest, overrides)).to.revertedWith('TR17')
    })

    it('reverts when pair is not enabled', async () => {
      const { relayer, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      const skipPairEnabled = true
      await configureForSwapping(skipPairEnabled)
      const buyRequest = getDefaultRelayerBuy(token, weth, wallet)

      await expect(relayer.buy(buyRequest, overrides)).to.revertedWith('TR5A')
    })

    it('does not revert when no ether was sent', async () => {
      const { relayer, delay, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()
      const buyRequest = getDefaultRelayerBuy(token, weth, wallet)

      await delay.setGasPrice(10000000)
      await expect(relayer.buy(buyRequest, overrides)).to.not.reverted
    })

    it('reverts when not enough ether was sent for unwrapping', async () => {
      const { relayer, delay, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()
      const buyRequest = getDefaultRelayerBuy(weth, token, wallet)
      buyRequest.wrapUnwrap = true

      const gasPrice = 10000000
      await delay.setGasPrice(gasPrice)
      await expect(
        relayer.buy(buyRequest, {
          ...overrides,
          value: 0,
        })
      ).to.revertedWith('TR03')
    })

    it('reverts when sell is disabled at Delay', async () => {
      const { relayer, delay, token, weth, wallet, wethPair, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()

      await delay.setOrderDisabled(wethPair.address, OrderType.Sell, true, overrides)
      const buyRequest = getDefaultRelayerBuy(token, weth, wallet)
      await expect(relayer.buy(buyRequest, overrides)).to.revertedWith('OS13')

      await delay.setOrderDisabled(wethPair.address, OrderType.Sell, false, overrides)
      await expect(relayer.buy(buyRequest, overrides)).to.be.not.reverted
    })
  })

  it('refunds excess value - in: weth, out: token, (un)wrap: true', async () => {
    const { relayer, delay, token, weth, wethPair, wallet, configureForSwapping, PRECISION } = await loadFixture(
      relayerFixture
    )
    await configureForSwapping()

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const balanceBefore = await wallet.getBalance()
    const wethBalanceBefore = await weth.balanceOf(wallet.address)
    const delayBalanceBefore = await wallet.provider.getBalance(delay.address)
    const delayWethBalanceBefore = await weth.balanceOf(delay.address)
    const relayerBalanceBefore = await wallet.provider.getBalance(relayer.address)
    const relayerWethBalanceBefore = await weth.balanceOf(relayer.address)

    const buyRequest = getDefaultRelayerBuy(weth, token, wallet)
    const tokenAmountOut = expandTo18Decimals(1)

    const price = (await relayer.getPriceByPairAddress(wethPair.address, false, overrides)).price
    const ethAmountIn = tokenAmountOut.mul(price).div(PRECISION)
    const buffer = expandTo18Decimals(0.001)

    const excess = 1234
    buyRequest.amountOut = tokenAmountOut
    buyRequest.amountInMax = ethAmountIn.add(buffer)
    const gasPrepaid = gasPrice.mul(await relayer.executionGasLimit())
    buyRequest.wrapUnwrap = true

    const tx = await relayer.buy(buyRequest, {
      ...overrides,
      value: ethAmountIn.add(buffer).add(gasPrepaid).add(excess),
    })

    const { gasUsed, effectiveGasPrice } = await tx.wait()
    const gasCost = gasUsed.mul(effectiveGasPrice)

    const balanceAfter = await wallet.getBalance()
    const wethBalanceAfter = await weth.balanceOf(wallet.address)
    const delayBalanceAfter = await wallet.provider.getBalance(delay.address)
    const delayWethBalanceAfter = await weth.balanceOf(delay.address)
    const relayerBalanceAfter = await wallet.provider.getBalance(relayer.address)
    const relayerWethBalanceAfter = await weth.balanceOf(relayer.address)

    expect(balanceBefore.sub(balanceAfter).gte(ethAmountIn.add(gasPrepaid).add(gasCost)))
    expect(balanceBefore.sub(balanceAfter).lte(ethAmountIn.add(buffer).add(gasPrepaid).add(gasCost)))
    expect(wethBalanceAfter).to.eq(wethBalanceBefore)
    expect(delayBalanceAfter.sub(delayBalanceBefore)).to.eq(gasPrepaid)
    expect(delayWethBalanceAfter.sub(delayWethBalanceBefore).gte(ethAmountIn))
    expect(delayWethBalanceAfter.sub(delayWethBalanceBefore).lte(ethAmountIn.add(buffer)))
    expect(relayerBalanceBefore).to.eq(relayerBalanceAfter)
    expect(relayerWethBalanceBefore).to.eq(relayerWethBalanceAfter)
  })

  it('reverts when sending excessive value - in: weth, out: token, (un)wrap: false', async () => {
    const { relayer, delay, token, weth, wethPair, wallet, configureForSwapping, PRECISION } = await loadFixture(
      relayerFixture
    )
    await configureForSwapping()

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const buyRequest = getDefaultRelayerBuy(weth, token, wallet)
    const tokenAmountOut = expandTo18Decimals(1)

    const price = (await relayer.getPriceByPairAddress(wethPair.address, false, overrides)).price
    const wethAmountIn = tokenAmountOut.mul(price).div(PRECISION)
    const buffer = expandTo18Decimals(0.001)

    const excess = 1234
    buyRequest.amountOut = tokenAmountOut
    buyRequest.amountInMax = wethAmountIn.add(buffer)
    buyRequest.wrapUnwrap = false

    await expect(
      relayer.buy(buyRequest, {
        ...overrides,
        value: excess,
      })
    ).to.revertedWith('TR58')
  })

  it('reverts when refunds excess value - in: token, out: weth, (un)wrap: true', async () => {
    const { relayer, delay, token, weth, wethPair, wallet, configureForSwapping, PRECISION } = await loadFixture(
      relayerFixture
    )
    await configureForSwapping()

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const buyRequest = getDefaultRelayerBuy(token, weth, wallet)
    const wethAmountOut = expandTo18Decimals(2)

    const price = (await relayer.getPriceByPairAddress(wethPair.address, false, overrides)).price
    const tokenAmountIn = wethAmountOut.mul(PRECISION).div(price)
    const buffer = expandTo18Decimals(0.001)

    const excess = 1234
    buyRequest.amountOut = wethAmountOut
    buyRequest.amountInMax = tokenAmountIn.add(buffer)
    const gasPrepaid = gasPrice.mul(await relayer.executionGasLimit())
    buyRequest.wrapUnwrap = true

    const tx = relayer.buy(buyRequest, {
      ...overrides,
      value: gasPrepaid.add(excess),
    })
    await expect(Promise.resolve(tx)).to.revertedWith('TR58')
  })

  it('reverts when sending excess value - in: token, out: weth, (un)wrap: false', async () => {
    const { relayer, delay, token, weth, wethPair, wallet, configureForSwapping, PRECISION } = await loadFixture(
      relayerFixture
    )
    await configureForSwapping()

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const buyRequest = getDefaultRelayerBuy(token, weth, wallet)
    const wethAmountOut = expandTo18Decimals(2)

    const price = (await relayer.getPriceByPairAddress(wethPair.address, false, overrides)).price
    const tokenAmountIn = wethAmountOut.mul(PRECISION).div(price)
    const buffer = expandTo18Decimals(0.001)

    const excess = 1234
    buyRequest.amountOut = wethAmountOut
    buyRequest.amountInMax = tokenAmountIn.add(buffer)
    const gasPrepaid = gasPrice.mul(await relayer.executionGasLimit())
    buyRequest.wrapUnwrap = false

    await expect(
      relayer.buy(buyRequest, {
        ...overrides,
        value: gasPrepaid.add(excess),
      })
    ).to.revertedWith('TR58')
  })

  it('refunds excess value with non-zero contract balance - in: weth, out: token, (un)wrap: true', async () => {
    const { relayer, delay, token, weth, wethPair, wallet, configureForSwapping, PRECISION } = await loadFixture(
      relayerFixture
    )
    await configureForSwapping()

    // send some eth to relayer before anything happends
    await wallet.sendTransaction({ to: relayer.address, value: 10000 })

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const balanceBefore = await wallet.getBalance()
    const wethBalanceBefore = await weth.balanceOf(wallet.address)
    const delayBalanceBefore = await wallet.provider.getBalance(delay.address)
    const delayWethBalanceBefore = await weth.balanceOf(delay.address)
    const relayerBalanceBefore = await wallet.provider.getBalance(relayer.address)
    const relayerWethBalanceBefore = await weth.balanceOf(relayer.address)

    const buyRequest = getDefaultRelayerBuy(weth, token, wallet)
    const tokenAmountOut = expandTo18Decimals(1)

    const price = (await relayer.getPriceByPairAddress(wethPair.address, false, overrides)).price
    const ethAmountIn = tokenAmountOut.mul(price).div(PRECISION)
    const buffer = expandTo18Decimals(0.001)

    const excess = 1234
    buyRequest.amountOut = tokenAmountOut
    buyRequest.amountInMax = ethAmountIn.add(buffer)
    const gasPrepaid = gasPrice.mul(await relayer.executionGasLimit())
    buyRequest.wrapUnwrap = true

    const tx = await relayer.buy(buyRequest, {
      ...overrides,
      value: ethAmountIn.add(buffer).add(gasPrepaid).add(excess),
    })

    const { gasUsed, effectiveGasPrice } = await tx.wait()
    const gasCost = gasUsed.mul(effectiveGasPrice)

    const balanceAfter = await wallet.getBalance()
    const wethBalanceAfter = await weth.balanceOf(wallet.address)
    const delayBalanceAfter = await wallet.provider.getBalance(delay.address)
    const delayWethBalanceAfter = await weth.balanceOf(delay.address)
    const relayerBalanceAfter = await wallet.provider.getBalance(relayer.address)
    const relayerWethBalanceAfter = await weth.balanceOf(relayer.address)

    expect(balanceBefore.sub(balanceAfter).gte(ethAmountIn.add(gasPrepaid).add(gasCost)))
    expect(balanceBefore.sub(balanceAfter).lte(ethAmountIn.add(buffer).add(gasPrepaid).add(gasCost)))
    expect(wethBalanceAfter).to.eq(wethBalanceBefore)
    expect(delayBalanceAfter.sub(delayBalanceBefore)).to.eq(gasPrepaid)
    expect(delayWethBalanceAfter.sub(delayWethBalanceBefore).gte(ethAmountIn))
    expect(delayWethBalanceAfter.sub(delayWethBalanceBefore).lte(ethAmountIn.add(buffer)))
    expect(relayerBalanceBefore).to.eq(relayerBalanceAfter)
    expect(relayerWethBalanceBefore).to.eq(relayerWethBalanceAfter)
  })

  it('reverts when sending excess value with non-zero contract balance - in: weth, out: token, (un)wrap: false', async () => {
    const { relayer, delay, token, weth, wethPair, wallet, configureForSwapping, PRECISION } = await loadFixture(
      relayerFixture
    )
    await configureForSwapping()

    // send some eth to relayer before anything happends
    await wallet.sendTransaction({ to: relayer.address, value: 10000 })

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const buyRequest = getDefaultRelayerBuy(weth, token, wallet)
    const tokenAmountOut = expandTo18Decimals(1)

    const price = (await relayer.getPriceByPairAddress(wethPair.address, false, overrides)).price
    const wethAmountIn = tokenAmountOut.mul(price).div(PRECISION)
    const buffer = expandTo18Decimals(0.001)

    const excess = 1234
    buyRequest.amountOut = tokenAmountOut
    buyRequest.amountInMax = wethAmountIn.add(buffer)
    const gasPrepaid = gasPrice.mul(await relayer.executionGasLimit())
    buyRequest.wrapUnwrap = false

    await expect(
      relayer.buy(buyRequest, {
        ...overrides,
        value: gasPrepaid.add(excess),
      })
    ).to.revertedWith('TR58')
  })

  it('reverts when refunds excess value with non-zero contract balance - in: token, out: weth, (un)wrap: true', async () => {
    const { relayer, delay, token, weth, wethPair, wallet, configureForSwapping, PRECISION } = await loadFixture(
      relayerFixture
    )
    await configureForSwapping()

    // send some eth to relayer before anything happends
    await wallet.sendTransaction({ to: relayer.address, value: 10000 })

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const buyRequest = getDefaultRelayerBuy(token, weth, wallet)
    const wethAmountOut = expandTo18Decimals(2)

    const price = (await relayer.getPriceByPairAddress(wethPair.address, false, overrides)).price
    const tokenAmountIn = wethAmountOut.mul(PRECISION).div(price)
    const buffer = expandTo18Decimals(0.001)

    const excess = 1234
    buyRequest.amountOut = wethAmountOut
    buyRequest.amountInMax = tokenAmountIn.add(buffer)
    const gasPrepaid = gasPrice.mul(await relayer.executionGasLimit())
    buyRequest.wrapUnwrap = true

    const tx = relayer.buy(buyRequest, {
      ...overrides,
      value: gasPrepaid.add(excess),
    })
    await expect(Promise.resolve(tx)).to.revertedWith('TR58')
  })

  it('refunds excess value with non-zero contract balance - in: token, out: weth, (un)wrap: false', async () => {
    const { relayer, delay, token, weth, wethPair, wallet, configureForSwapping, PRECISION } = await loadFixture(
      relayerFixture
    )
    await configureForSwapping()

    // send some eth to relayer before anything happends
    await wallet.sendTransaction({ to: relayer.address, value: 10000 })

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const buyRequest = getDefaultRelayerBuy(token, weth, wallet)
    const wethAmountOut = expandTo18Decimals(2)

    const price = (await relayer.getPriceByPairAddress(wethPair.address, false, overrides)).price
    const tokenAmountIn = wethAmountOut.mul(PRECISION).div(price)
    const buffer = expandTo18Decimals(0.001)

    const excess = 1234
    buyRequest.amountOut = wethAmountOut
    buyRequest.amountInMax = tokenAmountIn.add(buffer)
    const gasPrepaid = gasPrice.mul(await relayer.executionGasLimit())
    buyRequest.wrapUnwrap = false

    await expect(
      relayer.buy(buyRequest, {
        ...overrides,
        value: gasPrepaid.add(excess),
      })
    ).to.revertedWith('TR58')
  })

  it('enqueues an order', async () => {
    const { relayer, delay, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
    await configureForSwapping()

    const buyRequest = getDefaultRelayerBuy(token, weth, wallet)
    const tx = await relayer.buy(buyRequest, overrides)
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
    const { relayer, delay, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
    await configureForSwapping()

    await delay.setGasPrice(0)
    const buyRequest = getDefaultRelayerBuy(weth, token, wallet)

    const tx = await relayer.buy(buyRequest, overrides)
    const receipt = await tx.wait()
    const orderData = getSellOrderData(receipt)

    const newestOrderId = await delay.newestOrderId()
    const orderHashOnChain = await delay.getOrderHash(newestOrderId, overrides)
    const orderHash = getOrderDigest(orderData[0])
    expect(orderHash).to.be.eq(orderHashOnChain)
    expect(orderData[0].orderType).to.equal(OrderInternalType.SELL_INVERTED_TYPE)
  })

  it('returns orderId', async () => {
    const { relayer, token, weth, wethPair, wallet, configureForSwapping, PRECISION } = await loadFixture(
      relayerFixture
    )
    await configureForSwapping()

    const buyRequest = getDefaultRelayerBuy(token, weth, wallet)

    const fee = 1000
    await relayer.setSwapFee(wethPair.address, fee)

    const price = (await relayer.getPriceByPairAddress(wethPair.address, false)).price

    const expectedAmount0 = ceil_div(buyRequest.amountOut.mul(PRECISION), price)
    const expectedAmount0PlusFee = ceil_div(expectedAmount0.mul(PRECISION), PRECISION.sub(fee))
    const feeAmount = expectedAmount0PlusFee.sub(expectedAmount0)

    await expect(relayer.buy(buyRequest, overrides))
      .to.emit(relayer, 'Buy')
      .withArgs(
        wallet.address,
        token.address,
        weth.address,
        expectedAmount0PlusFee,
        buyRequest.amountInMax,
        buyRequest.amountOut,
        false,
        feeAmount,
        buyRequest.to,
        await relayer.delay(),
        1
      )
  })

  it('reverts when expected amountIn is less than actual amountIn', async () => {
    const { relayer, token, weth, wethPair, wallet, configureForSwapping, PRECISION } = await loadFixture(
      relayerFixture
    )
    await configureForSwapping()

    const buyRequest = getDefaultRelayerBuy(token, weth, wallet)
    buyRequest.amountInMax = BigNumber.from(10)

    const fee = 1000
    await relayer.setSwapFee(wethPair.address, fee)

    const price = (await relayer.getPriceByPairAddress(wethPair.address, false)).price

    let expectedAmount0 = buyRequest.amountOut.mul(expandTo18Decimals(1)).div(price)
    const feeAmount = expectedAmount0.mul(fee).div(PRECISION)
    expectedAmount0 = expectedAmount0.add(feeAmount)

    await expect(relayer.buy(buyRequest, overrides)).to.be.revertedWith('TR08')
  })
})
