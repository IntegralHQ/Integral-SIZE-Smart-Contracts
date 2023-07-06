import { expect } from 'chai'
import {
  lpTokenRewarderL1Fixture,
  lpTokenRewarderL1WithOnePoolFixture,
  lpTokenRewarderL2Fixture,
  lpTokenRewarderL2WithOnePoolFixture,
} from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'

describe('TwapLPTokenRewarderL1.setPoolAllocationPoints', () => {
  const loadFixture = setupFixtureLoader()

  it('fails to set a new value of allocation points for non-existent pool', async () => {
    // Arrange
    const { lpTokenRewarder } = await loadFixture(lpTokenRewarderL1WithOnePoolFixture)
    const nonExistentPid = 1

    // Act & Assert
    await expect(lpTokenRewarder.setPoolAllocationPoints(nonExistentPid, 200, true, overrides)).to.revertedWith('')
  })

  it('sets a new value of allocation points', async () => {
    // Arrange
    const { lpTokenRewarder, other } = await loadFixture(lpTokenRewarderL1WithOnePoolFixture)
    const pid = 0
    const newAlloactionPoints = 150

    // Act & Assert
    await expect(lpTokenRewarder.connect(other).setPoolAllocationPoints(pid, 200, true, overrides)).to.revertedWith(
      'LR00'
    )
    await expect(lpTokenRewarder.setPoolAllocationPoints(pid, newAlloactionPoints, true, overrides))
      .to.emit(lpTokenRewarder, 'PoolSet')
      .withArgs(pid, newAlloactionPoints)
    expect(await lpTokenRewarder.totalAllocationPoints()).to.eq(newAlloactionPoints)
  })

  it('sets new values of allocation points for 2 pools', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken, otherLpToken } = await loadFixture(lpTokenRewarderL1Fixture)
    const newAllocationPoints0 = 200
    const newAllocationPoints1 = 150
    const pid0 = 0
    const pid1 = 1

    // Act
    await lpTokenRewarder.addPool(lpToken.address, 100, true, overrides)
    await lpTokenRewarder.addPool(otherLpToken.address, 50, true, overrides)

    await lpTokenRewarder.setPoolAllocationPoints(pid0, newAllocationPoints0, true, overrides)
    await lpTokenRewarder.setPoolAllocationPoints(pid1, newAllocationPoints1, true, overrides)

    // Assert
    expect(await lpTokenRewarder.totalAllocationPoints()).to.eq(newAllocationPoints0 + newAllocationPoints1)
  })
})

describe('TwapLPTokenRewarderL2.setPoolAllocationPoints', () => {
  const loadFixture = setupFixtureLoader()

  it('fails to set a new value of allocation points for non-existent pool', async () => {
    // Arrange
    const { lpTokenRewarder } = await loadFixture(lpTokenRewarderL2WithOnePoolFixture)
    const nonExistentPid = 1

    // Act & Assert
    await expect(lpTokenRewarder.setPoolAllocationPoints(nonExistentPid, 200, true, overrides)).to.revertedWith('')
  })

  it('sets a new value of allocation points', async () => {
    // Arrange
    const { lpTokenRewarder, other } = await loadFixture(lpTokenRewarderL2WithOnePoolFixture)
    const pid = 0
    const newAlloactionPoints = 150

    // Act & Assert
    await expect(lpTokenRewarder.connect(other).setPoolAllocationPoints(pid, 200, true, overrides)).to.revertedWith(
      'LR00'
    )
    await expect(lpTokenRewarder.setPoolAllocationPoints(pid, newAlloactionPoints, true, overrides))
      .to.emit(lpTokenRewarder, 'PoolSet')
      .withArgs(pid, newAlloactionPoints)
    expect(await lpTokenRewarder.totalAllocationPoints()).to.eq(newAlloactionPoints)
  })

  it('sets new values of allocation points for 2 pools', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken, otherLpToken } = await loadFixture(lpTokenRewarderL2Fixture)
    const newAllocationPoints0 = 200
    const newAllocationPoints1 = 150
    const pid0 = 0
    const pid1 = 1

    // Act
    await lpTokenRewarder.addPool(lpToken.address, 100, true, overrides)
    await lpTokenRewarder.addPool(otherLpToken.address, 50, true, overrides)

    await lpTokenRewarder.setPoolAllocationPoints(pid0, newAllocationPoints0, true, overrides)
    await lpTokenRewarder.setPoolAllocationPoints(pid1, newAllocationPoints1, true, overrides)

    // Assert
    expect(await lpTokenRewarder.totalAllocationPoints()).to.eq(newAllocationPoints0 + newAllocationPoints1)
  })
})
