import { expect } from 'chai'
import { lpTokenRewarderL1Fixture, lpTokenRewarderL2Fixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'

describe('TwapLPTokenRewarderL1.setItgrPerSecond', () => {
  const loadFixture = setupFixtureLoader()

  it('set ITGR per second', async () => {
    // Arrange
    const { lpTokenRewarder, other } = await loadFixture(lpTokenRewarderL1Fixture)

    // Act & Assert
    await expect(lpTokenRewarder.connect(other).setItgrPerSecond(987654321, false, overrides)).to.be.revertedWith(
      'LR00'
    )
    expect(await lpTokenRewarder.setItgrPerSecond(123456789, false, overrides)).to.emit(
      lpTokenRewarder,
      'ItgrPerSecondSet'
    )
    await expect(lpTokenRewarder.setItgrPerSecond(123456789, false, overrides)).to.be.revertedWith('LR01')
    expect(await lpTokenRewarder.itgrPerSecond()).to.eq(123456789)
  })
})

describe('TwapLPTokenRewarderL2.setItgrPerSecond', () => {
  const loadFixture = setupFixtureLoader()

  it('set ITGR per second', async () => {
    // Arrange
    const { lpTokenRewarder, other } = await loadFixture(lpTokenRewarderL2Fixture)

    // Act & Assert
    await expect(lpTokenRewarder.connect(other).setItgrPerSecond(987654321, false, overrides)).to.be.revertedWith(
      'LR00'
    )
    expect(await lpTokenRewarder.setItgrPerSecond(123456789, false, overrides)).to.emit(
      lpTokenRewarder,
      'ItgrPerSecondSet'
    )
    await expect(lpTokenRewarder.setItgrPerSecond(123456789, false, overrides)).to.be.revertedWith('LR01')
    expect(await lpTokenRewarder.itgrPerSecond()).to.eq(123456789)
  })
})
