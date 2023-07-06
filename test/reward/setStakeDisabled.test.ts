import { expect } from 'chai'
import { lpTokenRewarderL1Fixture, lpTokenRewarderL2Fixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'

describe('TwapLPTokenRewarderL1.setStakeDisabled', () => {
  const loadFixture = setupFixtureLoader()

  it('set stake disabled', async () => {
    // Arrange
    const { lpTokenRewarder, other } = await loadFixture(lpTokenRewarderL1Fixture)

    // Act & Assert
    expect(await lpTokenRewarder.stakeDisabled()).to.eq(false)
    await expect(lpTokenRewarder.connect(other).setStakeDisabled(true, overrides)).to.be.revertedWith('LR00')
    expect(await lpTokenRewarder.setStakeDisabled(true, overrides))
      .to.emit(lpTokenRewarder, 'StakeDisabledSet')
      .withArgs(true)
    await expect(lpTokenRewarder.setStakeDisabled(true, overrides)).to.be.revertedWith('LR01')
    expect(await lpTokenRewarder.stakeDisabled()).to.eq(true)
  })
})

describe('TwapLPTokenRewarderL2.setStakeDisabled', () => {
  const loadFixture = setupFixtureLoader()

  it('set stake disabled', async () => {
    // Arrange
    const { lpTokenRewarder, other } = await loadFixture(lpTokenRewarderL2Fixture)

    // Act & Assert
    expect(await lpTokenRewarder.stakeDisabled()).to.eq(false)
    await expect(lpTokenRewarder.connect(other).setStakeDisabled(true, overrides)).to.be.revertedWith('LR00')
    expect(await lpTokenRewarder.setStakeDisabled(true, overrides))
      .to.emit(lpTokenRewarder, 'StakeDisabledSet')
      .withArgs(true)
    await expect(lpTokenRewarder.setStakeDisabled(true, overrides)).to.be.revertedWith('LR01')
    expect(await lpTokenRewarder.stakeDisabled()).to.eq(true)
  })
})
