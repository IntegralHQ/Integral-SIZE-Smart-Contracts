import { expect } from 'chai'
import { relayerFixture } from '../shared/fixtures/relayerFixture'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, getEvents, overrides } from '../shared/utilities'
import { BigNumber } from 'ethers'
import { getSellOrderData } from '../shared/orders'

describe('TwapRelayer.rebalance', () => {
  const loadFixture = setupFixtureLoader()

  it('reverts when do sell with delay if rebalancer is not set', async () => {
    const { relayer, token, weth } = await loadFixture(relayerFixture)

    await expect(
      relayer.rebalanceSellWithDelay(weth.address, token.address, expandTo18Decimals(0.001), overrides)
    ).to.be.revertedWith('TR00')
  })

  it('reverts when do sell with 1inch if rebalancer is not set', async () => {
    const { relayer } = await loadFixture(relayerFixture)

    const fakeAddress = '0x1234567890123456789012345678901234567890'
    const amountIn = BigNumber.from('1000')
    const gas = 200_000
    const data = '0x112233112233112233112233112233112233112233112233112233112233112233112233'
    await expect(
      relayer.rebalanceSellWithOneInch(fakeAddress, amountIn, fakeAddress, gas, data, overrides)
    ).to.be.revertedWith('TR00')
  })

  it('reverts when setting owner as rebalancer', async () => {
    const { relayer, wallet, configureForSwapping } = await loadFixture(relayerFixture)
    await configureForSwapping()

    await expect(relayer.setRebalancer(wallet.address, overrides)).to.be.revertedWith('TR5D')
  })

  it('reverts when setting rebalancer by non-owner', async () => {
    const { relayer, another } = await loadFixture(relayerFixture)

    await expect(relayer.connect(another).setRebalancer(another.address, overrides)).to.be.revertedWith('TR00')
  })

  it('reverts when do sell with 1inch if address is not whitelisted', async () => {
    const { relayer, another } = await loadFixture(relayerFixture)

    await relayer.setRebalancer(another.address, overrides)

    const fakeAddress = '0x1234567890123456789012345678901234567890'
    const amountIn = BigNumber.from('1000')
    const gas = 200_000
    const data = '0x112233112233112233112233112233112233112233112233112233112233112233112233'
    await expect(
      relayer.connect(another).rebalanceSellWithOneInch(fakeAddress, amountIn, fakeAddress, gas, data, overrides)
    ).to.be.revertedWith('TR5F')
  })

  it('should have enqueued an order after calling rebalanceSellWithDelay()', async () => {
    const { relayer, delay, token, weth, another, configureForSwapping } = await loadFixture(relayerFixture)
    await configureForSwapping()

    await relayer.setRebalancer(another.address, overrides)

    const amountIn = expandTo18Decimals(1)
    const tx = await relayer.connect(another).rebalanceSellWithDelay(weth.address, token.address, amountIn, overrides)
    const event = await getEvents(tx, 'RebalanceSellWithDelay')
    const delayOrderId = event[0].args?.['delayOrderId']
    expect(delayOrderId).equal(1)

    const receipt = await tx.wait()
    const orderData = getSellOrderData(receipt)
    const orderStatus = await delay.getOrderStatus(delayOrderId, orderData[0].validAfterTimestamp)
    expect(orderStatus).equal(1)
  })
})
