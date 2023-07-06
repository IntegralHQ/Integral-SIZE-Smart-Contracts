import { expect } from 'chai'
import { constants } from 'ethers'
import { delayFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'

describe('TwapLimitOrder.setOwner', () => {
  const loadFixture = setupFixtureLoader()

  it('is set to the deployer', async () => {
    const { limitOrder, wallet } = await loadFixture(delayFixture)
    expect(await limitOrder.owner()).to.eq(wallet.address)
  })

  it('can be changed', async () => {
    const { limitOrder, other } = await loadFixture(delayFixture)
    await expect(limitOrder.connect(other).setOwner(other.address, overrides)).to.be.revertedWith('TL00')

    await expect(limitOrder.setOwner(other.address, overrides)).to.emit(limitOrder, 'OwnerSet').withArgs(other.address)
    expect(await limitOrder.owner()).to.eq(other.address)
  })

  it('performs address checks when setting owner', async () => {
    const { limitOrder, wallet } = await loadFixture(delayFixture)
    await expect(limitOrder.setOwner(wallet.address, overrides)).to.be.revertedWith('TL01')
    await expect(limitOrder.setOwner(constants.AddressZero, overrides)).to.be.revertedWith('TL02')
  })
})
