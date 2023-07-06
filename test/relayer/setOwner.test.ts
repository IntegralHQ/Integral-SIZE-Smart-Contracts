import { expect } from 'chai'
import { setupFixtureLoader } from '../shared/setup'
import { relayerFixture } from '../shared/fixtures'
import { overrides } from '../shared/utilities'
import { constants } from 'ethers'

describe('TwapRelayer.setOwner', () => {
  const loadFixture = setupFixtureLoader()

  it('is set to the deployer', async () => {
    const { relayer, wallet } = await loadFixture(relayerFixture)
    expect(await relayer.owner()).to.eq(wallet.address)
  })

  it('can be changed', async () => {
    const { relayer, other } = await loadFixture(relayerFixture)
    await expect(relayer.connect(other).setOwner(other.address, overrides)).to.be.revertedWith('TR00')

    await expect(relayer.setOwner(other.address, overrides)).to.emit(relayer, 'OwnerSet').withArgs(other.address)
    expect(await relayer.owner()).to.eq(other.address)
  })

  it('performs address checks when setting owner', async () => {
    const { relayer, wallet } = await loadFixture(relayerFixture)
    await expect(relayer.setOwner(wallet.address, overrides)).to.be.revertedWith('TR01')
    await expect(relayer.setOwner(constants.AddressZero, overrides)).to.be.revertedWith('TR02')
  })
})
