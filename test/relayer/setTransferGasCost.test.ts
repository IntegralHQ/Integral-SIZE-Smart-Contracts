import { expect } from 'chai'
import { overrides } from '../shared/utilities'
import { relayerFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'

describe('TwapRelayer.setTransferGasCost', () => {
  const loadFixture = setupFixtureLoader()

  it('can only be called by the owner', async () => {
    const { relayer, other } = await loadFixture(relayerFixture)
    await expect(relayer.connect(other).setEthTransferGasCost(1111, overrides)).to.be.revertedWith('TR00')
  })

  it('cannot be set to same value', async () => {
    const { relayer } = await loadFixture(relayerFixture)
    const gasCost = await relayer.ethTransferGasCost()
    await expect(relayer.setEthTransferGasCost(gasCost, overrides)).to.be.revertedWith('TR01')
  })
})
