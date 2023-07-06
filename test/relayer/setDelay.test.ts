import { expect } from 'chai'
import { setupFixtureLoader } from '../shared/setup'
import { relayerFixture } from '../shared/fixtures'
import { overrides } from '../shared/utilities'
import { constants } from 'ethers'

describe('TwapRelayer.setDelay', () => {
  const loadFixture = setupFixtureLoader()

  it('is set to the constructor parameter', async () => {
    const { delay, relayer } = await loadFixture(relayerFixture)
    expect(await relayer.delay()).to.eq(delay.address)
  })

  it('can be changed', async () => {
    const { relayer, other } = await loadFixture(relayerFixture)
    await expect(relayer.connect(other).setDelay(other.address, overrides)).to.be.revertedWith('TR00')

    await expect(relayer.setDelay(other.address, overrides)).to.emit(relayer, 'DelaySet').withArgs(other.address)
    expect(await relayer.delay()).to.eq(other.address)
  })

  it('performs address checks when setting delay', async () => {
    const { delay, relayer } = await loadFixture(relayerFixture)
    await expect(relayer.setDelay(delay.address, overrides)).to.be.revertedWith('TR01')
    await expect(relayer.setDelay(constants.AddressZero, overrides)).to.be.revertedWith('TR02')
  })
})
