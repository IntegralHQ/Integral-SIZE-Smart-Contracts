import { expect } from 'chai'
import { setupFixtureLoader } from '../shared/setup'
import { getDefaultRelayerSell, relayerFixture } from '../shared/fixtures'
import { overrides } from '../shared/utilities'

describe('TwapRelayer.setPairEnabled', () => {
  const loadFixture = setupFixtureLoader()

  it('is set to false on deploy', async () => {
    const { relayer, pair } = await loadFixture(relayerFixture)
    expect(await relayer.isPairEnabled(pair.address)).to.eq(false)
  })

  it('can be changed', async () => {
    const { relayer, other, pair } = await loadFixture(relayerFixture)
    await expect(relayer.connect(other).setPairEnabled(pair.address, true, overrides)).to.be.revertedWith('TR00')

    await expect(relayer.setPairEnabled(pair.address, true, overrides))
      .to.emit(relayer, 'PairEnabledSet')
      .withArgs(pair.address, true)
    expect(await relayer.isPairEnabled(pair.address)).to.eq(true)
  })

  it('cannot be set to same value', async () => {
    const { relayer, pair } = await loadFixture(relayerFixture)
    await expect(relayer.setPairEnabled(pair.address, false, overrides)).to.be.revertedWith('TR01')
  })

  it('swap reverts unless pair enabled', async () => {
    const { relayer, wethPair, token, weth, wallet } = await loadFixture(relayerFixture)

    const sellParams = getDefaultRelayerSell(token, weth, wallet)
    await expect(relayer.sell(sellParams, overrides)).to.be.revertedWith('TR5A')

    await relayer.setPairEnabled(wethPair.address, true, overrides)
    await expect(relayer.sell(sellParams, overrides)).to.not.be.revertedWith('TR5A')
  })
})
