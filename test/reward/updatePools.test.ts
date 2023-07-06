import { expect } from 'chai'
import { lpTokenRewarderL1Fixture, lpTokenRewarderL2Fixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'

describe('TwapLPTokenRewarderL1.updatePools', () => {
  const loadFixture = setupFixtureLoader()

  it('fails to update non-existent pools', async () => {
    // Arrange
    const { lpTokenRewarder } = await loadFixture(lpTokenRewarderL1Fixture)
    const nonexistentPoolId = 0

    // Act & Assert
    await expect(lpTokenRewarder.updatePools([nonexistentPoolId], overrides)).to.be.revertedWith('')
  })

  it('update pools', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken, otherLpToken } = await loadFixture(lpTokenRewarderL1Fixture)
    const pid0 = 0
    const pid1 = 1
    await lpTokenRewarder.addPool(lpToken.address, 100, true, overrides)
    await lpTokenRewarder.addPool(otherLpToken.address, 50, true, overrides)
    const pool0Before = await lpTokenRewarder.pools(pid0)
    const pool1Before = await lpTokenRewarder.pools(pid1)

    // Act
    await lpTokenRewarder.updatePools([pid0, pid1], overrides)

    const pool0After = await lpTokenRewarder.pools(pid0)
    const pool1After = await lpTokenRewarder.pools(pid1)

    // Assert
    expect(pool0Before.lastRewardTimestamp).to.be.lt(pool0After.lastRewardTimestamp)
    expect(pool1Before.lastRewardTimestamp).to.be.lt(pool1After.lastRewardTimestamp)
  })
})

describe('TwapLPTokenRewarderL2.updatePools', () => {
  const loadFixture = setupFixtureLoader()

  it('fails to update non-existent pools', async () => {
    // Arrange
    const { lpTokenRewarder } = await loadFixture(lpTokenRewarderL2Fixture)
    const nonexistentPoolId = 0

    // Act & Assert
    await expect(lpTokenRewarder.updatePools([nonexistentPoolId], overrides)).to.be.revertedWith('')
  })

  it('update pools', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken, otherLpToken } = await loadFixture(lpTokenRewarderL2Fixture)
    const pid0 = 0
    const pid1 = 1
    await lpTokenRewarder.addPool(lpToken.address, 100, true, overrides)
    await lpTokenRewarder.addPool(otherLpToken.address, 50, true, overrides)
    const pool0Before = await lpTokenRewarder.pools(pid0)
    const pool1Before = await lpTokenRewarder.pools(pid1)

    // Act
    await lpTokenRewarder.updatePools([pid0, pid1], overrides)

    const pool0After = await lpTokenRewarder.pools(pid0)
    const pool1After = await lpTokenRewarder.pools(pid1)

    // Assert
    expect(pool0Before.lastRewardTimestamp).to.be.lt(pool0After.lastRewardTimestamp)
    expect(pool1Before.lastRewardTimestamp).to.be.lt(pool1After.lastRewardTimestamp)
  })
})
