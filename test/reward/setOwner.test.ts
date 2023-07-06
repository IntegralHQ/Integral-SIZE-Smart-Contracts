import { expect } from 'chai'
import { constants } from 'ethers'
import { lpTokenRewarderL1Fixture, lpTokenRewarderL2Fixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'

describe('TwapLPTokenRewarderL1.setOwner', () => {
  const loadFixture = setupFixtureLoader()

  it('set owner', async () => {
    // Arrange
    const { lpTokenRewarder, wallet, other } = await loadFixture(lpTokenRewarderL1Fixture)

    // Act & Assert
    await expect(lpTokenRewarder.connect(other).setOwner(other.address, overrides)).to.be.revertedWith('LR00')
    await expect(lpTokenRewarder.setOwner(wallet.address, overrides)).to.be.revertedWith('LR01')
    await expect(lpTokenRewarder.setOwner(constants.AddressZero, overrides)).to.be.revertedWith('LR02')
    await expect(lpTokenRewarder.setOwner(other.address, overrides))
      .to.emit(lpTokenRewarder, 'OwnerSet')
      .withArgs(other.address)
  })
})

describe('TwapLPTokenRewarderL2.setOwner', () => {
  const loadFixture = setupFixtureLoader()

  it('set owner', async () => {
    // Arrange
    const { lpTokenRewarder, wallet, other } = await loadFixture(lpTokenRewarderL2Fixture)

    // Act & Assert
    await expect(lpTokenRewarder.connect(other).setOwner(other.address, overrides)).to.be.revertedWith('LR00')
    await expect(lpTokenRewarder.setOwner(wallet.address, overrides)).to.be.revertedWith('LR01')
    await expect(lpTokenRewarder.setOwner(constants.AddressZero, overrides)).to.be.revertedWith('LR02')
    await expect(lpTokenRewarder.setOwner(other.address, overrides))
      .to.emit(lpTokenRewarder, 'OwnerSet')
      .withArgs(other.address)
  })
})
