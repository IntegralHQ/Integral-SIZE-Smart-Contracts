import { expect } from 'chai'
import { constants, BigNumber, utils } from 'ethers'
import { getDefaultRelayerSell, relayerFixture } from '../shared/fixtures/relayerFixture'
import { getOrderDigest, getSellOrderData } from '../shared/orders'
import { OrderInternalType, OrderType } from '../shared/OrderType'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, INVALID_ADDRESS, overrides } from '../shared/utilities'

describe('TwapRelayer.sell', () => {
  const loadFixture = setupFixtureLoader()

  describe('checks', () => {
    it('accounts for weth being used', async () => {
      const { relayer, delay, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()

      const gasLimit = 10000
      const gasPrice = 100
      await delay.setGasPrice(gasPrice)

      const sellRequest = getDefaultRelayerSell(weth, token, wallet)
      sellRequest.amountIn = BigNumber.from(gasLimit * gasPrice + 1)
      sellRequest.wrapUnwrap = true

      await expect(
        relayer.sell(sellRequest, {
          ...overrides,
          value: sellRequest.amountIn,
        })
      ).to.revertedWith('TR03')
    })

    it('reverts when pair does not exist', async () => {
      const { relayer, token0, token1, wallet } = await loadFixture(relayerFixture)
      const sellRequest = getDefaultRelayerSell(token0, token1, wallet)
      sellRequest.tokenIn = INVALID_ADDRESS

      await expect(relayer.sell(sellRequest, overrides)).to.revertedWith('TR17')
    })

    it('reverts when twap interval not set', async () => {
      const { relayer, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping(false, true)
      const sellRequest = getDefaultRelayerSell(token, weth, wallet)

      await expect(relayer.sell(sellRequest, overrides)).to.revertedWith('TR55')
    })

    it('fails if the deadline is exceeded', async () => {
      const { relayer, token, weth, wallet, provider, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()
      const sellRequest = getDefaultRelayerSell(token, weth, wallet)
      sellRequest.submitDeadline = await provider.getBlockNumber()

      await expect(relayer.sell(sellRequest, overrides)).to.revertedWith('OS04')
    })

    it('reverts when amountIn is zero', async () => {
      const { relayer, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()
      const sellRequest = getDefaultRelayerSell(token, weth, wallet)
      sellRequest.amountIn = BigNumber.from(0)

      await expect(relayer.sell(sellRequest, overrides)).to.revertedWith('OS24')
    })

    it('reverts when address to is not set', async () => {
      const { relayer, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()
      const sellRequest = getDefaultRelayerSell(token, weth, wallet)
      sellRequest.to = constants.AddressZero

      await expect(relayer.sell(sellRequest, overrides)).to.revertedWith('TR26')
    })

    it('reverts when gasLimit is lower than minimum', async () => {
      const { relayer, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()
      await relayer.setExecutionGasLimit(999)
      const sellRequest = getDefaultRelayerSell(token, weth, wallet)

      await expect(relayer.sell(sellRequest, overrides)).to.revertedWith('OS3D')
    })

    it('reverts when gasLimit is higher than maximum', async () => {
      const { relayer, delay, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()
      await relayer.setExecutionGasLimit(160001)
      const sellRequest = getDefaultRelayerSell(token, weth, wallet)

      await delay.setMaxGasLimit(160000)
      await expect(relayer.sell(sellRequest, overrides)).to.revertedWith('OS3E')
    })

    it('reverts when pair does not exist', async () => {
      const { relayer, token0, token, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()
      const sellRequest = getDefaultRelayerSell(token, token0, wallet)

      await expect(relayer.sell(sellRequest, overrides)).to.revertedWith('TR17')
    })

    it('reverts when pair is not enabled', async () => {
      const { relayer, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      const skipPairEnabled = true
      await configureForSwapping(skipPairEnabled)
      const sellRequest = getDefaultRelayerSell(token, weth, wallet)

      await expect(relayer.sell(sellRequest, overrides)).to.revertedWith('TR5A')
    })

    it('does not revert when no ether was sent', async () => {
      const { relayer, delay, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()
      const sellRequest = getDefaultRelayerSell(token, weth, wallet)

      await delay.setGasPrice(10000000)
      await expect(relayer.sell(sellRequest, overrides)).to.not.reverted
    })

    it('reverts when not enough ether was sent for unwrapping', async () => {
      const { relayer, delay, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()
      const sellRequest = getDefaultRelayerSell(weth, token, wallet)
      sellRequest.wrapUnwrap = true

      const gasPrice = 10000000
      await delay.setGasPrice(gasPrice)
      await expect(
        relayer.sell(sellRequest, {
          ...overrides,
          value: 0,
        })
      ).to.revertedWith('TR59')
    })

    it('reverts when sell is disabled at Delay', async () => {
      const { relayer, delay, token, weth, wallet, wethPair, configureForSwapping } = await loadFixture(relayerFixture)
      await configureForSwapping()

      await delay.setOrderDisabled(wethPair.address, OrderType.Sell, true, overrides)
      const sellRequest = getDefaultRelayerSell(token, weth, wallet)
      await expect(relayer.sell(sellRequest, overrides)).to.revertedWith('OS13')

      await delay.setOrderDisabled(wethPair.address, OrderType.Sell, false, overrides)
      await expect(relayer.sell(sellRequest, overrides)).to.be.not.reverted
    })
  })

  it('reverts when sending excess value - in: weth, out: token, (un)wrap: true', async () => {
    const { relayer, delay, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
    await configureForSwapping()

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const sellRequest = getDefaultRelayerSell(weth, token, wallet)
    const wethAmount = utils.parseUnits('2', 'ether')
    const excess = 1234
    sellRequest.amountIn = wethAmount
    const gasPrepaid = gasPrice.mul(await relayer.executionGasLimit())
    sellRequest.wrapUnwrap = true

    await expect(
      relayer.sell(sellRequest, {
        ...overrides,
        value: gasPrepaid.add(wethAmount).add(excess),
      })
    ).to.revertedWith('TR59')
  })

  it('reverts when sending excess value - in: weth, out: token, (un)wrap: false', async () => {
    const { relayer, delay, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
    await configureForSwapping()

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const sellRequest = getDefaultRelayerSell(weth, token, wallet)
    const wethAmount = utils.parseUnits('2', 'ether')
    const excess = 1234
    sellRequest.amountIn = wethAmount
    const gasPrepaid = gasPrice.mul(await relayer.executionGasLimit())
    sellRequest.wrapUnwrap = false

    await expect(
      relayer.sell(sellRequest, {
        ...overrides,
        value: gasPrepaid.add(excess),
      })
    ).to.revertedWith('TR58')
  })

  it('reverts when sending excess value - in: token, out: weth, (un)wrap: true', async () => {
    const { relayer, delay, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
    await configureForSwapping()

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const sellRequest = getDefaultRelayerSell(token, weth, wallet)
    const tokenInAmount = expandTo18Decimals(1)
    const excess = 1234
    sellRequest.amountIn = tokenInAmount
    const gasPrepaid = gasPrice.mul(await relayer.executionGasLimit())
    sellRequest.wrapUnwrap = true

    await expect(
      relayer.sell(sellRequest, {
        ...overrides,
        value: gasPrepaid.add(excess),
      })
    ).to.revertedWith('TR58')
  })

  it('reverts when sending excess value - in: token, out: weth, (un)wrap: false', async () => {
    const { relayer, delay, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
    await configureForSwapping()

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const sellRequest = getDefaultRelayerSell(token, weth, wallet)
    const tokenInAmount = expandTo18Decimals(1)
    const excess = 1234
    sellRequest.amountIn = tokenInAmount
    const gasPrepaid = gasPrice.mul(await relayer.executionGasLimit())
    sellRequest.wrapUnwrap = false

    await expect(
      relayer.sell(sellRequest, {
        ...overrides,
        value: gasPrepaid.add(excess),
      })
    ).to.revertedWith('TR58')
  })

  it('reverts when sending excess value with non-zero contract balance - in: weth, out: token, (un)wrap: true', async () => {
    const { relayer, delay, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
    await configureForSwapping()

    // send some eth to relayer before anything happends
    await wallet.sendTransaction({ to: relayer.address, value: 10000 })

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const sellRequest = getDefaultRelayerSell(weth, token, wallet)
    const wethAmount = utils.parseUnits('2', 'ether')
    const excess = 1234
    sellRequest.amountIn = wethAmount
    const gasPrepaid = gasPrice.mul(await relayer.executionGasLimit())
    sellRequest.wrapUnwrap = true

    await expect(
      relayer.sell(sellRequest, {
        ...overrides,
        value: gasPrepaid.add(wethAmount).add(excess),
      })
    ).to.revertedWith('TR59')
  })

  it('reverts when sending excess value with non-zero contract balance - in: weth, out: token, (un)wrap: false', async () => {
    const { relayer, delay, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
    await configureForSwapping()

    // send some eth to relayer before anything happends
    await wallet.sendTransaction({ to: relayer.address, value: 10000 })

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const sellRequest = getDefaultRelayerSell(weth, token, wallet)
    const wethAmount = utils.parseUnits('2', 'ether')
    const excess = 1234
    sellRequest.amountIn = wethAmount
    const gasPrepaid = gasPrice.mul(await relayer.executionGasLimit())
    sellRequest.wrapUnwrap = false

    await expect(
      relayer.sell(sellRequest, {
        ...overrides,
        value: gasPrepaid.add(excess),
      })
    ).to.revertedWith('TR58')
  })

  it('reverts when sending excess value with non-zero contract balance - in: token, out: weth, (un)wrap: true', async () => {
    const { relayer, delay, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
    await configureForSwapping()

    // send some eth to relayer before anything happends
    await wallet.sendTransaction({ to: relayer.address, value: 10000 })

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const sellRequest = getDefaultRelayerSell(token, weth, wallet)
    const tokenInAmount = expandTo18Decimals(1)
    const excess = 1234
    sellRequest.amountIn = tokenInAmount
    const gasPrepaid = gasPrice.mul(await relayer.executionGasLimit())
    sellRequest.wrapUnwrap = true

    await expect(
      relayer.sell(sellRequest, {
        ...overrides,
        value: gasPrepaid.add(excess),
      })
    ).to.revertedWith('TR58')
  })

  it('reverts when sending excess value with non-zero contract balance - in: token, out: weth, (un)wrap: false', async () => {
    const { relayer, delay, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
    await configureForSwapping()

    // send some eth to relayer before anything happends
    await wallet.sendTransaction({ to: relayer.address, value: 10000 })

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const sellRequest = getDefaultRelayerSell(token, weth, wallet)
    const tokenInAmount = expandTo18Decimals(1)
    const excess = 1234
    sellRequest.amountIn = tokenInAmount
    const gasPrepaid = gasPrice.mul(await relayer.executionGasLimit())
    sellRequest.wrapUnwrap = false

    await expect(
      relayer.sell(sellRequest, {
        ...overrides,
        value: gasPrepaid.add(excess),
      })
    ).to.revertedWith('TR58')
  })

  it('enqueues an order', async () => {
    const { relayer, delay, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
    await configureForSwapping()

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const sellRequest = getDefaultRelayerSell(token, weth, wallet)

    const tx = await relayer.sell(sellRequest, overrides)
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

    const sellRequest = getDefaultRelayerSell(weth, token, wallet)
    await delay.setGasPrice(0, overrides)

    const tx = await relayer.sell(sellRequest, overrides)
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

    const sellRequest = getDefaultRelayerSell(token, weth, wallet)

    const fee = 1000
    await relayer.setSwapFee(wethPair.address, fee)

    const price = (await relayer.getPriceByPairAddress(wethPair.address, false)).price

    const feeAmount = sellRequest.amountIn.mul(fee).div(PRECISION)
    const effectiveAmount0 = sellRequest.amountIn.sub(feeAmount)
    const expectedAmount1 = effectiveAmount0.mul(price).div(expandTo18Decimals(1))

    await expect(relayer.sell(sellRequest, overrides))
      .to.emit(relayer, 'Sell')
      .withArgs(
        wallet.address,
        token.address,
        weth.address,
        sellRequest.amountIn,
        expectedAmount1,
        sellRequest.amountOutMin,
        false,
        feeAmount,
        sellRequest.to,
        await relayer.delay(),
        1
      )
  })

  it('returns if expected amountOut is more than actual amountOut', async () => {
    const { relayer, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
    await configureForSwapping()

    const sellRequest = getDefaultRelayerSell(token, weth, wallet)
    sellRequest.amountOutMin = expandTo18Decimals('9999999999')

    await expect(relayer.sell(sellRequest, overrides)).to.be.revertedWith('TR37')
  })
})
