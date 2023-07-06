import { expect } from 'chai'
import {
  lpTokenRewarderL1Fixture,
  lpTokenRewarderL1WithOnePoolFixture,
  lpTokenRewarderL2Fixture,
  lpTokenRewarderL2WithOnePoolFixture,
} from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'

describe('TwapLPTokenRewarderL1.updatePool', () => {
  const loadFixture = setupFixtureLoader()

  it('fails to update non-existent pool', async () => {
    // Arrange
    const { lpTokenRewarder } = await loadFixture(lpTokenRewarderL1Fixture)
    const nonexistentPoolId = 0

    // Act & Assert
    await expect(lpTokenRewarder.updatePool(nonexistentPoolId, overrides)).to.be.revertedWith('')
  })

  it('update pool', async () => {
    // Arrange
    const { lpTokenRewarder } = await loadFixture(lpTokenRewarderL1WithOnePoolFixture)
    const pid = 0

    // Act & Assert
    const poolBefore = await lpTokenRewarder.pools(pid)
    expect(await lpTokenRewarder.updatePool(pid, overrides)).to.emit(lpTokenRewarder, 'PoolUpdated')
    const poolAfter = await lpTokenRewarder.pools(pid)
    expect(poolBefore.lastRewardTimestamp).to.be.lt(poolAfter.lastRewardTimestamp)
  })
})

describe('TwapLPTokenRewarderL2.updatePool', () => {
  const loadFixture = setupFixtureLoader()

  it('fails to update non-existent pool', async () => {
    // Arrange
    const { lpTokenRewarder } = await loadFixture(lpTokenRewarderL2Fixture)
    const nonexistentPoolId = 0

    // Act & Assert
    await expect(lpTokenRewarder.updatePool(nonexistentPoolId, overrides)).to.be.revertedWith('')
  })

  it('update pool', async () => {
    // Arrange
    const { lpTokenRewarder } = await loadFixture(lpTokenRewarderL2WithOnePoolFixture)
    const pid = 0

    // Act & Assert
    const poolBefore = await lpTokenRewarder.pools(pid)
    expect(await lpTokenRewarder.updatePool(pid, overrides)).to.emit(lpTokenRewarder, 'PoolUpdated')
    const poolAfter = await lpTokenRewarder.pools(pid)
    expect(poolBefore.lastRewardTimestamp).to.be.lt(poolAfter.lastRewardTimestamp)
  })
})
