import { expect } from 'chai'
import { constants } from 'ethers'
import { delayFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'

describe('TwapDelay.setOwner', () => {
  const loadFixture = setupFixtureLoader()

  it('is set to the deployer', async () => {
    const { delay, wallet } = await loadFixture(delayFixture)
    expect(await delay.owner()).to.eq(wallet.address)
  })

  it('can be changed', async () => {
    const { delay, other } = await loadFixture(delayFixture)
    await expect(delay.connect(other).setOwner(other.address, overrides)).to.be.revertedWith('TD00')

    await expect(delay.setOwner(other.address, overrides)).to.emit(delay, 'OwnerSet').withArgs(other.address)
    expect(await delay.owner()).to.eq(other.address)
  })

  it.skip('performs address checks when setting owner', async () => {
    const { delay, wallet } = await loadFixture(delayFixture)
    await expect(delay.setOwner(wallet.address, overrides)).to.be.revertedWith('TD01')
    await expect(delay.setOwner(constants.AddressZero, overrides)).to.be.revertedWith('TD02')
  })
})
