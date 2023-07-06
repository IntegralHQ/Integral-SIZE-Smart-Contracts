import { expect } from 'chai'
import { overrides } from '../shared/utilities'
import { getDefaultRelayerBuy, getDefaultRelayerSell, relayerFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { BigNumber, utils } from 'ethers'
import { intToHex } from 'ethereumjs-util'

describe('TwapRelayer.proxy', () => {
  const loadFixture = setupFixtureLoader()

  it('cannot initialize again', async () => {
    const { relayer } = await loadFixture(relayerFixture)

    const initialized = await relayer.initialized()
    expect(initialized).equal(1)

    const fakeAddress = '0x1234567890123456789012345678901234567890'
    await expect(relayer.initialize(fakeAddress, fakeAddress, fakeAddress, overrides)).to.be.revertedWith('TR5B')
  })

  it('should be able get admin address', async () => {
    const { relayerProxy, wallet } = await loadFixture(relayerFixture)

    const admin = await relayerProxy.admin()

    expect(admin).equal(wallet.address)
  })

  it('should be able to change admin', async () => {
    const { relayerProxy, wallet } = await loadFixture(relayerFixture)

    const fakeAddress = '0x1234567890123456789012345678901234567890'

    await expect(relayerProxy.setAdmin(fakeAddress, overrides))
      .emit(relayerProxy, 'AdminChanged')
      .withArgs(wallet.address, fakeAddress)
  })

  it('should not be able to change admin if not the admin', async () => {
    const { relayerProxy, wallet } = await loadFixture(relayerFixture)

    const fakeAddress = '0x1234567890123456789012345678901234567890'
    const fakeAddress2 = '0x0987654321098765432109876543210987654321'

    await expect(relayerProxy.setAdmin(fakeAddress, overrides))
      .emit(relayerProxy, 'AdminChanged')
      .withArgs(wallet.address, fakeAddress)

    await expect(relayerProxy.setAdmin(fakeAddress2, overrides)).to.be.revertedWith('PX00')
  })

  it('should be able get implementation address', async () => {
    const { relayerProxy, relayerImplementation } = await loadFixture(relayerFixture)

    const implementationAddress = await relayerProxy.implementation()

    expect(implementationAddress).equal(relayerImplementation.address)
  })

  it('should be able to change implementation', async () => {
    const { relayerProxy } = await loadFixture(relayerFixture)

    const fakeAddress = '0x1234567890123456789012345678901234567890'

    await expect(relayerProxy.setImplementation(fakeAddress, overrides))
      .emit(relayerProxy, 'Upgraded')
      .withArgs(fakeAddress)
  })

  it('should not be able to change implementation if not the admin', async () => {
    const { relayerProxy, wallet } = await loadFixture(relayerFixture)

    const fakeAddress = '0x1234567890123456789012345678901234567890'
    const fakeAddress2 = '0x0987654321098765432109876543210987654321'

    await expect(relayerProxy.setAdmin(fakeAddress, overrides))
      .emit(relayerProxy, 'AdminChanged')
      .withArgs(wallet.address, fakeAddress)

    await expect(relayerProxy.setImplementation(fakeAddress2, overrides)).to.be.revertedWith('PX00')
  })

  it('should be able to transfer ETH to proxy contract', async () => {
    const { relayerProxy, wallet } = await loadFixture(relayerFixture)
    const provider = wallet.provider
    const expectedBalance = BigNumber.from('1000')

    const tx = {
      from: wallet.address,
      to: relayerProxy.address,
      value: expectedBalance,
      nonce: provider.getTransactionCount(wallet.address, 'latest'),
      gasLimit: 100000,
      gasPrice: wallet.getGasPrice(),
    }

    await wallet.sendTransaction(tx)

    const proxyBalance = await provider.getBalance(relayerProxy.address)
    expect(proxyBalance).equal(expectedBalance)
  })

  it('should have correct initial values in storage', async () => {
    const { relayerProxy, factory, weth, delay, wallet } = await loadFixture(relayerFixture)
    const provider = wallet.provider

    const storage0 = (await provider.getStorageAt(relayerProxy.address, 0)).substring(2) // Rmoved leading 0x
    const initializedStr = storage0.substring(storage0.length - 2)
    const lockedStr = storage0.substring(storage0.length - 4, storage0.length - 2)
    const ownerStr = storage0.substring(storage0.length - 44, storage0.length - 4)

    const storage1 = (await provider.getStorageAt(relayerProxy.address, 1)).substring(2) // Rmoved leading 0x
    const factoryStr = storage1.substring(storage1.length - 40)

    const storage2 = (await provider.getStorageAt(relayerProxy.address, 2)).substring(2) // Rmoved leading 0x
    const wethStr = storage2.substring(storage2.length - 40)

    const storage3 = (await provider.getStorageAt(relayerProxy.address, 3)).substring(2) // Rmoved leading 0x
    const delayStr = storage3.substring(storage3.length - 40)

    const storage4 = await provider.getStorageAt(relayerProxy.address, 4)
    const ethTransferGasCost = BigNumber.from(storage4)

    const storage5 = await provider.getStorageAt(relayerProxy.address, 5)
    const executionGasLimit = BigNumber.from(storage5)

    const storage6 = await provider.getStorageAt(relayerProxy.address, 6)
    const gasPriceMultiplier = BigNumber.from(storage6)

    const storage7 = await provider.getStorageAt(relayerProxy.address, 7)
    const swapFeeMappingSlot = storage7

    const storage8 = await provider.getStorageAt(relayerProxy.address, 8)
    const twapIntervalMappingSlot = storage8

    const storage9 = await provider.getStorageAt(relayerProxy.address, 9)
    const isPairEnabledMappingSlot = storage9

    const storage10 = await provider.getStorageAt(relayerProxy.address, 10)
    const tokenLimitMinMappingSlot = storage10

    const storage11 = await provider.getStorageAt(relayerProxy.address, 11)
    const tokenLimitMaxMultiplierMappingSlot = storage11

    const storage12 = await provider.getStorageAt(relayerProxy.address, 12)
    const toleranceMappingSlot = storage12

    await expect(initializedStr).equal('01')
    await expect(lockedStr).equal('00')
    await expect(ownerStr.toLowerCase()).equal(wallet.address.substring(2).toLowerCase())
    await expect(factoryStr.toLowerCase()).equal(factory.address.substring(2).toLowerCase())
    await expect(wethStr.toLowerCase()).equal(weth.address.substring(2).toLowerCase())
    await expect(delayStr.toLowerCase()).equal(delay.address.substring(2).toLowerCase())
    await expect(ethTransferGasCost).equal(2600 + 1504)
    await expect(executionGasLimit).equal(0)
    await expect(gasPriceMultiplier).equal(0)
    await expect(swapFeeMappingSlot).equal('0x0000000000000000000000000000000000000000000000000000000000000000')
    await expect(twapIntervalMappingSlot).equal('0x0000000000000000000000000000000000000000000000000000000000000000')
    await expect(isPairEnabledMappingSlot).equal('0x0000000000000000000000000000000000000000000000000000000000000000')
    await expect(tokenLimitMinMappingSlot).equal('0x0000000000000000000000000000000000000000000000000000000000000000')
    await expect(tokenLimitMaxMultiplierMappingSlot).equal(
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    )
    await expect(toleranceMappingSlot).equal('0x0000000000000000000000000000000000000000000000000000000000000000')
  })

  it('should have correct values in storage after setting a new implementation', async () => {
    const { relayerProxy, factory, weth, delay, wallet } = await loadFixture(relayerFixture)
    const provider = wallet.provider

    const fakeAddress = '0x1234567890123456789012345678901234567890'
    await relayerProxy.setImplementation(fakeAddress, overrides)

    const storage0 = (await provider.getStorageAt(relayerProxy.address, 0)).substring(2) // Rmoved leading 0x
    const initializedStr = storage0.substring(storage0.length - 2)
    const lockedStr = storage0.substring(storage0.length - 4, storage0.length - 2)
    const ownerStr = storage0.substring(storage0.length - 44, storage0.length - 4)

    const storage1 = (await provider.getStorageAt(relayerProxy.address, 1)).substring(2) // Rmoved leading 0x
    const factoryStr = storage1.substring(storage1.length - 40)

    const storage2 = (await provider.getStorageAt(relayerProxy.address, 2)).substring(2) // Rmoved leading 0x
    const wethStr = storage2.substring(storage2.length - 40)

    const storage3 = (await provider.getStorageAt(relayerProxy.address, 3)).substring(2) // Rmoved leading 0x
    const delayStr = storage3.substring(storage3.length - 40)

    const storage4 = await provider.getStorageAt(relayerProxy.address, 4)
    const ethTransferGasCost = BigNumber.from(storage4)

    const storage5 = await provider.getStorageAt(relayerProxy.address, 5)
    const executionGasLimit = BigNumber.from(storage5)

    const storage6 = await provider.getStorageAt(relayerProxy.address, 6)
    const gasPriceMultiplier = BigNumber.from(storage6)

    const storage7 = await provider.getStorageAt(relayerProxy.address, 7)
    const swapFeeMappingSlot = storage7

    const storage8 = await provider.getStorageAt(relayerProxy.address, 8)
    const twapIntervalMappingSlot = storage8

    const storage9 = await provider.getStorageAt(relayerProxy.address, 9)
    const isPairEnabledMappingSlot = storage9

    const storage10 = await provider.getStorageAt(relayerProxy.address, 10)
    const tokenLimitMinMappingSlot = storage10

    const storage11 = await provider.getStorageAt(relayerProxy.address, 11)
    const tokenLimitMaxMultiplierMappingSlot = storage11

    const storage12 = await provider.getStorageAt(relayerProxy.address, 12)
    const toleranceMappingSlot = storage12

    await expect(initializedStr).equal('01')
    await expect(lockedStr).equal('00')
    await expect(ownerStr.toLowerCase()).equal(wallet.address.substring(2).toLowerCase())
    await expect(factoryStr.toLowerCase()).equal(factory.address.substring(2).toLowerCase())
    await expect(wethStr.toLowerCase()).equal(weth.address.substring(2).toLowerCase())
    await expect(delayStr.toLowerCase()).equal(delay.address.substring(2).toLowerCase())
    await expect(ethTransferGasCost).equal(2600 + 1504)
    await expect(executionGasLimit).equal(0)
    await expect(gasPriceMultiplier).equal(0)
    await expect(swapFeeMappingSlot).equal('0x0000000000000000000000000000000000000000000000000000000000000000')
    await expect(twapIntervalMappingSlot).equal('0x0000000000000000000000000000000000000000000000000000000000000000')
    await expect(isPairEnabledMappingSlot).equal('0x0000000000000000000000000000000000000000000000000000000000000000')
    await expect(tokenLimitMinMappingSlot).equal('0x0000000000000000000000000000000000000000000000000000000000000000')
    await expect(tokenLimitMaxMultiplierMappingSlot).equal(
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    )
    await expect(toleranceMappingSlot).equal('0x0000000000000000000000000000000000000000000000000000000000000000')
  })

  it('should have correct values in storage after setting a new implementation and set new values', async () => {
    const { relayerProxy, relayer, relayerImplementation2, factory, weth, wallet } = await loadFixture(relayerFixture)
    const provider = wallet.provider

    await relayerProxy.setImplementation(relayerImplementation2.address, overrides)

    const expectedDelayAddress = '0x1234567890123456789012345678901234567890'
    await relayer.setDelay(expectedDelayAddress, overrides)

    const expectedEthTransferGasCost = BigNumber.from(123456)
    await relayer.setEthTransferGasCost(expectedEthTransferGasCost, overrides)

    const expectedExecutionGasLimit = BigNumber.from(369852)
    await relayer.setExecutionGasLimit(expectedExecutionGasLimit, overrides)

    const expectedGasPriceMultiplier = BigNumber.from(33445566)
    await relayer.setGasPriceMultiplier(expectedGasPriceMultiplier, overrides)

    const fakePairAddress1 = '0x1122334455112233445511223344551122334455'
    const expectedSwapFee = BigNumber.from(4589632)
    await relayer.setSwapFee(fakePairAddress1, expectedSwapFee, overrides)

    const fakePairAddress2 = '0x2255889966225588996622558899662255889966'
    const expectedTwapInterval = BigNumber.from(6854723)
    await relayer.setTwapInterval(fakePairAddress2, expectedTwapInterval, overrides)

    const fakePairAddress3 = '0x5566998844556699884455669988445566998844'
    const expectedPairEnabled = true
    await relayer.setPairEnabled(fakePairAddress3, expectedPairEnabled, overrides)

    const fakeTokenAddress1 = '0x6854297516685429751668542975166854297516'
    const expectedTokenLimitMin = BigNumber.from(4654982546654)
    await relayer.setTokenLimitMin(fakeTokenAddress1, expectedTokenLimitMin, overrides)

    const fakeTokenAddress2 = '0x5698224985569822498556982249855698224985'
    const expectedTokenLimitMaxMultiplier = BigNumber.from(4654982546654)
    await relayer.setTokenLimitMaxMultiplier(fakeTokenAddress2, expectedTokenLimitMaxMultiplier, overrides)

    const fakePairAddress4 = '0x2569854123256985412325698541232569854123'
    const expectedTolerance = BigNumber.from(8)
    await relayer.setTolerance(fakePairAddress4, expectedTolerance, overrides)

    const expectedOwnerAddress = '0x6932584561693258456169325845616932584561'
    await relayer.setOwner(expectedOwnerAddress, overrides)

    const storage0 = (await provider.getStorageAt(relayerProxy.address, 0)).substring(2) // Rmoved leading 0x
    const initializedStr = storage0.substring(storage0.length - 2)
    const lockedStr = storage0.substring(storage0.length - 4, storage0.length - 2)
    const ownerStr = storage0.substring(storage0.length - 44, storage0.length - 4)

    const storage1 = (await provider.getStorageAt(relayerProxy.address, 1)).substring(2) // Rmoved leading 0x
    const factoryStr = storage1.substring(storage1.length - 40)

    const storage2 = (await provider.getStorageAt(relayerProxy.address, 2)).substring(2) // Rmoved leading 0x
    const wethStr = storage2.substring(storage2.length - 40)

    const storage3 = (await provider.getStorageAt(relayerProxy.address, 3)).substring(2) // Rmoved leading 0x
    const delayStr = storage3.substring(storage3.length - 40)

    const storage4 = await provider.getStorageAt(relayerProxy.address, 4)
    const ethTransferGasCost = BigNumber.from(storage4)

    const storage5 = await provider.getStorageAt(relayerProxy.address, 5)
    const executionGasLimit = BigNumber.from(storage5)

    const storage6 = await provider.getStorageAt(relayerProxy.address, 6)
    const gasPriceMultiplier = BigNumber.from(storage6)

    const storage7 = await provider.getStorageAt(relayerProxy.address, 7)
    const swapFeeMappingSlot = storage7

    const storage8 = await provider.getStorageAt(relayerProxy.address, 8)
    const twapIntervalMappingSlot = storage8

    const storage9 = await provider.getStorageAt(relayerProxy.address, 9)
    const isPairEnabledMappingSlot = storage9

    const storage10 = await provider.getStorageAt(relayerProxy.address, 10)
    const tokenLimitMinMappingSlot = storage10

    const storage11 = await provider.getStorageAt(relayerProxy.address, 11)
    const tokenLimitMaxMultiplierMappingSlot = storage11

    const storage12 = await provider.getStorageAt(relayerProxy.address, 12)
    const toleranceMappingSlot = storage12

    await expect(initializedStr).equal('01')
    await expect(lockedStr).equal('00')
    await expect(ownerStr.toLowerCase()).equal(expectedOwnerAddress.substring(2))
    await expect(factoryStr.toLowerCase()).equal(factory.address.substring(2).toLowerCase())
    await expect(wethStr.toLowerCase()).equal(weth.address.substring(2).toLowerCase())
    await expect(delayStr.toLowerCase()).equal(expectedDelayAddress.substring(2))
    await expect(ethTransferGasCost).equal(expectedEthTransferGasCost)
    await expect(executionGasLimit).equal(expectedExecutionGasLimit)
    await expect(gasPriceMultiplier).equal(expectedGasPriceMultiplier)
    await expect(swapFeeMappingSlot).equal('0x0000000000000000000000000000000000000000000000000000000000000000')
    await expect(twapIntervalMappingSlot).equal('0x0000000000000000000000000000000000000000000000000000000000000000')
    await expect(isPairEnabledMappingSlot).equal('0x0000000000000000000000000000000000000000000000000000000000000000')
    await expect(tokenLimitMinMappingSlot).equal('0x0000000000000000000000000000000000000000000000000000000000000000')
    await expect(tokenLimitMaxMultiplierMappingSlot).equal(
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    )
    await expect(toleranceMappingSlot).equal('0x0000000000000000000000000000000000000000000000000000000000000000')

    let slot, paddedAddress, paddedSlot, concatenated, hash, value

    // SweepFee
    slot = 7
    paddedAddress = utils.hexZeroPad(fakePairAddress1, 32)
    paddedSlot = utils.hexZeroPad(intToHex(slot), 32)
    concatenated = utils.concat([paddedAddress, paddedSlot])
    hash = utils.keccak256(concatenated)
    value = BigNumber.from(await provider.getStorageAt(relayer.address, hash))
    await expect(value).equal(expectedSwapFee)

    // TwapInterval
    slot = 8
    paddedAddress = utils.hexZeroPad(fakePairAddress2, 32)
    paddedSlot = utils.hexZeroPad(intToHex(slot), 32)
    concatenated = utils.concat([paddedAddress, paddedSlot])
    hash = utils.keccak256(concatenated)
    value = BigNumber.from(await provider.getStorageAt(relayer.address, hash))
    await expect(value).equal(expectedTwapInterval)

    // isPairEnabled
    slot = 9
    paddedAddress = utils.hexZeroPad(fakePairAddress3, 32)
    paddedSlot = utils.hexZeroPad(intToHex(slot), 32)
    concatenated = utils.concat([paddedAddress, paddedSlot])
    hash = utils.keccak256(concatenated)
    value = BigNumber.from(await provider.getStorageAt(relayer.address, hash))
    await expect(value).equal(+expectedPairEnabled)

    // TokenLimitMin
    slot = 10
    paddedAddress = utils.hexZeroPad(fakeTokenAddress1, 32)
    paddedSlot = utils.hexZeroPad(intToHex(slot), 32)
    concatenated = utils.concat([paddedAddress, paddedSlot])
    hash = utils.keccak256(concatenated)
    value = BigNumber.from(await provider.getStorageAt(relayer.address, hash))
    await expect(value).equal(expectedTokenLimitMin)

    // TokenLimitMaxMultiplier
    slot = 11
    paddedAddress = utils.hexZeroPad(fakeTokenAddress2, 32)
    paddedSlot = utils.hexZeroPad(intToHex(slot), 32)
    concatenated = utils.concat([paddedAddress, paddedSlot])
    hash = utils.keccak256(concatenated)
    value = BigNumber.from(await provider.getStorageAt(relayer.address, hash))
    await expect(value).equal(expectedTokenLimitMaxMultiplier)

    // Tolerance
    slot = 12
    paddedAddress = utils.hexZeroPad(fakePairAddress4, 32)
    paddedSlot = utils.hexZeroPad(intToHex(slot), 32)
    concatenated = utils.concat([paddedAddress, paddedSlot])
    hash = utils.keccak256(concatenated)
    value = BigNumber.from(await provider.getStorageAt(relayer.address, hash))
    await expect(value).equal(expectedTolerance)
  })

  it('should have correct value in storage - setOwner', async () => {
    const { relayer, wallet } = await loadFixture(relayerFixture)
    const provider = wallet.provider
    const slot = 0
    const expectedOwner = '0x1234567890123456789012345678901234567890'

    await relayer.setOwner(expectedOwner)

    const storage = await provider.getStorageAt(relayer.address, slot)
    const value = storage.substring(storage.length - 44, storage.length - 4)
    await expect('0x' + value).equal(expectedOwner)

    const owner = await relayer.owner()
    await expect(owner).equal(expectedOwner)
  })

  it('should have correct value in storage - setDelay', async () => {
    const { relayer, wallet } = await loadFixture(relayerFixture)
    const provider = wallet.provider
    const slot = 3
    const expectedDelay = '0x1234567890123456789012345678901234567890'

    await relayer.setDelay(expectedDelay)

    const storage = await provider.getStorageAt(relayer.address, slot)
    const value = storage.substring(storage.length - 40)
    await expect('0x' + value).equal(expectedDelay)

    const delay = await relayer.delay()
    await expect(delay).equal(expectedDelay)
  })

  it('should have correct value in storage - setEthTransferGasCost', async () => {
    const { relayer, wallet } = await loadFixture(relayerFixture)
    const provider = wallet.provider
    const slot = 4
    const expectedEthTransferGasCost = BigNumber.from(6_000_000)

    await relayer.setEthTransferGasCost(expectedEthTransferGasCost)

    const storage = await provider.getStorageAt(relayer.address, slot)
    const value = BigNumber.from(storage)
    await expect(value).equal(expectedEthTransferGasCost)

    const ethTransferGasCost = await relayer.ethTransferGasCost()
    await expect(ethTransferGasCost).equal(expectedEthTransferGasCost)
  })

  it('should have correct value in storage - setExecutionGasLimit', async () => {
    const { relayer, wallet } = await loadFixture(relayerFixture)
    const provider = wallet.provider
    const slot = 5
    const expectedExecutionGasLimit = BigNumber.from(6_000_000)

    await relayer.setExecutionGasLimit(expectedExecutionGasLimit)

    const storage = await provider.getStorageAt(relayer.address, slot)
    const value = BigNumber.from(storage)
    await expect(value).equal(expectedExecutionGasLimit)

    const executionGasLimit = await relayer.executionGasLimit()
    await expect(executionGasLimit).equal(expectedExecutionGasLimit)
  })

  it('should have correct value in storage - setGasPriceMultiplier', async () => {
    const { relayer, wallet } = await loadFixture(relayerFixture)
    const provider = wallet.provider
    const slot = 6
    const expectedGasPriceMultiplier = BigNumber.from(2)

    await relayer.setGasPriceMultiplier(expectedGasPriceMultiplier)

    const storage = await provider.getStorageAt(relayer.address, slot)
    const value = BigNumber.from(storage)
    await expect(value).equal(expectedGasPriceMultiplier)

    const gasPriceMultiplier = await relayer.gasPriceMultiplier()
    await expect(gasPriceMultiplier).equal(expectedGasPriceMultiplier)
  })

  it('should have correct value in storage - setSwapFee', async () => {
    const { relayer, wallet } = await loadFixture(relayerFixture)
    const provider = wallet.provider
    const fakeAddress = '0x1234567890123456789012345678901234567890'
    const slot = 7
    const expectedSwapFee = BigNumber.from(100)

    await relayer.setSwapFee(fakeAddress, expectedSwapFee)

    const paddedAddress = utils.hexZeroPad(fakeAddress, 32)
    const paddedSlot = utils.hexZeroPad(intToHex(slot), 32)
    const concatenated = utils.concat([paddedAddress, paddedSlot])
    const hash = utils.keccak256(concatenated)
    const value = BigNumber.from(await provider.getStorageAt(relayer.address, hash))
    await expect(value).equal(expectedSwapFee)

    const swapFee = await relayer.swapFee(fakeAddress)
    await expect(swapFee).equal(expectedSwapFee)
  })

  it('should have correct value in storage - setTwapInterval', async () => {
    const { relayer, wallet } = await loadFixture(relayerFixture)
    const provider = wallet.provider
    const fakeAddress = '0x1234567890123456789012345678901234567890'
    const slot = 8
    const expectedTwapInterval = BigNumber.from(3000)

    await relayer.setTwapInterval(fakeAddress, expectedTwapInterval)

    const paddedAddress = utils.hexZeroPad(fakeAddress, 32)
    const paddedSlot = utils.hexZeroPad(intToHex(slot), 32)
    const concatenated = utils.concat([paddedAddress, paddedSlot])
    const hash = utils.keccak256(concatenated)
    const value = BigNumber.from(await provider.getStorageAt(relayer.address, hash))
    await expect(value).equal(expectedTwapInterval)

    const twapInterval = await relayer.twapInterval(fakeAddress)
    await expect(twapInterval).equal(expectedTwapInterval)
  })

  it('should have correct value in storage - setPairEnabled', async () => {
    const { relayer, wallet } = await loadFixture(relayerFixture)
    const provider = wallet.provider
    const fakeAddress = '0x1234567890123456789012345678901234567890'
    const slot = 9
    const expectedPairEnabled = true

    await relayer.setPairEnabled(fakeAddress, expectedPairEnabled)

    const paddedAddress = utils.hexZeroPad(fakeAddress, 32)
    const paddedSlot = utils.hexZeroPad(intToHex(slot), 32)
    const concatenated = utils.concat([paddedAddress, paddedSlot])
    const hash = utils.keccak256(concatenated)
    const value = await provider.getStorageAt(relayer.address, hash)
    await expect(parseInt(value, 16)).equal(+expectedPairEnabled)

    const pairEnabled = await relayer.isPairEnabled(fakeAddress)
    await expect(pairEnabled).equal(expectedPairEnabled)
  })

  it('should have correct value in storage - setTokenLimitMin', async () => {
    const { relayer, wallet } = await loadFixture(relayerFixture)
    const provider = wallet.provider
    const fakeAddress = '0x1234567890123456789012345678901234567890'
    const slot = 10
    const expectedTokenLimitMin = BigNumber.from(3330)

    await relayer.setTokenLimitMin(fakeAddress, expectedTokenLimitMin)

    const paddedAddress = utils.hexZeroPad(fakeAddress, 32)
    const paddedSlot = utils.hexZeroPad(intToHex(slot), 32)
    const concatenated = utils.concat([paddedAddress, paddedSlot])
    const hash = utils.keccak256(concatenated)
    const value = BigNumber.from(await provider.getStorageAt(relayer.address, hash))
    await expect(value).equal(expectedTokenLimitMin)

    const tokenLimitMin = await relayer.tokenLimitMin(fakeAddress)
    await expect(tokenLimitMin).equal(expectedTokenLimitMin)
  })

  it('should have correct value in storage - setTokenLimitMaxMultiplier', async () => {
    const { relayer, wallet } = await loadFixture(relayerFixture)
    const provider = wallet.provider
    const fakeAddress = '0x1234567890123456789012345678901234567890'
    const slot = 11
    const expectedTokenLimitMaxMultiplier = BigNumber.from(50000)

    await relayer.setTokenLimitMaxMultiplier(fakeAddress, expectedTokenLimitMaxMultiplier)

    const paddedAddress = utils.hexZeroPad(fakeAddress, 32)
    const paddedSlot = utils.hexZeroPad(intToHex(slot), 32)
    const concatenated = utils.concat([paddedAddress, paddedSlot])
    const hash = utils.keccak256(concatenated)
    const value = BigNumber.from(await provider.getStorageAt(relayer.address, hash))
    await expect(value).equal(expectedTokenLimitMaxMultiplier)

    const tokenLimitMaxMultiplier = await relayer.tokenLimitMaxMultiplier(fakeAddress)
    await expect(tokenLimitMaxMultiplier).equal(expectedTokenLimitMaxMultiplier)
  })

  it('should have correct value in storage - setTolerance', async () => {
    const { relayer, wallet } = await loadFixture(relayerFixture)
    const provider = wallet.provider
    const fakeAddress = '0x1234567890123456789012345678901234567890'
    const slot = 12
    const expectedTolerance = BigNumber.from(9)

    await relayer.setTolerance(fakeAddress, expectedTolerance, overrides)

    const paddedAddress = utils.hexZeroPad(fakeAddress, 32)
    const paddedSlot = utils.hexZeroPad(intToHex(slot), 32)
    const concatenated = utils.concat([paddedAddress, paddedSlot])
    const hash = utils.keccak256(concatenated)
    const value = BigNumber.from(await provider.getStorageAt(relayer.address, hash))
    await expect(value).equal(expectedTolerance)

    const tolerance = await relayer.tolerance(fakeAddress)
    await expect(tolerance).equal(expectedTolerance)
  })

  it('reverts when directly calling buy() function at implementation contract', async () => {
    const { relayerImplementation, token, weth, wallet } = await loadFixture(relayerFixture)

    const buyRequest = getDefaultRelayerBuy(token, weth, wallet)

    await expect(
      relayerImplementation.buy(buyRequest, {
        ...overrides,
      })
    ).to.revertedWith('TR06')
  })

  it('reverts when directly calling sell() function at implementation contract', async () => {
    const { relayerImplementation, token, weth, wallet } = await loadFixture(relayerFixture)

    const sellRequest = getDefaultRelayerSell(token, weth, wallet)

    await expect(
      relayerImplementation.sell(sellRequest, {
        ...overrides,
      })
    ).to.revertedWith('TR06')
  })
})
