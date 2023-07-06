import { expect } from 'chai'
import { setupFixtureLoader } from '../shared/setup'
import { getDefaultRelayerSell, relayerFixture } from '../shared/fixtures'
import { expandTo18Decimals, overrides } from '../shared/utilities'
import { DelayTest__factory, TwapRelayerTest__factory, TwapRelayerProxyTest__factory } from '../../build/types'
import { constants } from 'ethers'
import { setTokenTransferCosts } from '../shared/fixtures/helpers'

describe('TwapRelayer.gasLimit', () => {
  const loadFixture = setupFixtureLoader()

  it('is set to zero on deploy', async () => {
    const { relayer } = await loadFixture(relayerFixture)
    expect(await relayer.executionGasLimit()).to.eq(0)
    expect(await relayer.gasPriceMultiplier()).to.eq(0)
  })

  it('can be changed', async () => {
    const { relayer, other } = await loadFixture(relayerFixture)
    await expect(relayer.connect(other).setExecutionGasLimit(1, overrides)).to.be.revertedWith('TR00')
    await expect(relayer.connect(other).setGasPriceMultiplier(1, overrides)).to.be.revertedWith('TR00')

    await expect(relayer.setExecutionGasLimit(1, overrides)).to.emit(relayer, 'ExecutionGasLimitSet').withArgs(1)
    expect(await relayer.executionGasLimit()).to.eq(1)

    await expect(relayer.setGasPriceMultiplier(1, overrides)).to.emit(relayer, 'GasPriceMultiplierSet').withArgs(1)
    expect(await relayer.gasPriceMultiplier()).to.eq(1)
  })

  it('cannot be set to same value', async () => {
    const { relayer } = await loadFixture(relayerFixture)
    await expect(relayer.setExecutionGasLimit(0, overrides)).to.be.revertedWith('TR01')
    await expect(relayer.setGasPriceMultiplier(0, overrides)).to.be.revertedWith('TR01')
  })

  it('swap reverts unless gas limit set', async () => {
    const { relayer, token, weth, wallet, configureForSwapping } = await loadFixture(relayerFixture)
    await configureForSwapping(false, false, false, true)

    const sellParams = getDefaultRelayerSell(token, weth, wallet)
    await expect(relayer.sell(sellParams, overrides)).to.be.revertedWith('TR3C')

    await relayer.setExecutionGasLimit(0, overrides)
    await expect(relayer.sell(sellParams, overrides)).to.be.revertedWith('TR3D')

    await relayer.setExecutionGasLimit(550000, overrides)
    await relayer.setGasPriceMultiplier(expandTo18Decimals(1.05), overrides)

    await expect(relayer.sell(sellParams, overrides)).to.not.be.revertedWith('TR3C')
    await expect(relayer.sell(sellParams, overrides)).to.not.be.revertedWith('TR3D')
  })

  it('calculate prepay gas correctly', async () => {
    const { libraries, factory, token, weth, wallet, configureForSwapping, PRECISION } = await loadFixture(
      relayerFixture
    )

    const delay = await new DelayTest__factory(libraries, wallet).deploy(
      factory.address,
      weth.address,
      constants.AddressZero,
      {
        gasPrice: 5000000,
      }
    )

    await setTokenTransferCosts(delay, [token, weth])

    const relayerImplementation = await new TwapRelayerTest__factory(wallet).deploy(overrides)

    const relayerProxy = await new TwapRelayerProxyTest__factory(wallet).deploy(
      relayerImplementation.address,
      overrides
    )

    const relayerProxyAsRelayer = TwapRelayerTest__factory.connect(relayerProxy.address, wallet)

    await relayerProxyAsRelayer.initialize(factory.address, delay.address, weth.address, overrides)

    const relayer = TwapRelayerTest__factory.connect(relayerProxy.address, wallet)

    await relayer.approve(token.address, constants.MaxUint256, delay.address)
    await relayer.approve(weth.address, constants.MaxUint256, delay.address)
    await configureForSwapping(false, false, false, false, false, relayer)

    const gasPrice = await delay.gasPrice()
    const gasLimit = await relayer.executionGasLimit(overrides)
    const multiplier = await relayer.gasPriceMultiplier(overrides)
    const expectedPrepay = gasPrice.mul(multiplier).mul(gasLimit).div(PRECISION)

    const sellParams = getDefaultRelayerSell(token, weth, wallet)
    sellParams.wrapUnwrap = true
    const expectedDelayFutureFee = gasPrice.mul(await relayer.executionGasLimit())
    const expectedDelayRefund = expectedPrepay.sub(expectedDelayFutureFee)

    const relayerBalanceBefore = await wallet.provider.getBalance(relayer.address)
    const delayBalanceBefore = await wallet.provider.getBalance(delay.address)
    await relayer.sell(sellParams, overrides)
    const relayerBalanceAfter = await wallet.provider.getBalance(relayer.address)
    const delayBalanceAfter = await wallet.provider.getBalance(delay.address)

    expect(delayBalanceAfter.sub(delayBalanceBefore)).to.eq(expectedDelayFutureFee)
    expect(relayerBalanceBefore.sub(relayerBalanceAfter)).to.eq(expectedPrepay.sub(expectedDelayRefund))
  })
})
