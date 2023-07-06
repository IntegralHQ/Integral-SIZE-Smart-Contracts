import { expect } from 'chai'
import { lpTokenRewarderL1Fixture, lpTokenRewarderL2Fixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'

describe('TwapLPTokenRewarderL1.addPool', () => {
  const loadFixture = setupFixtureLoader()

  it('fails to add already existing LP pool', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken } = await loadFixture(lpTokenRewarderL1Fixture)

    // Act
    await lpTokenRewarder.addPool(lpToken.address, 100, true)

    // Assert
    await expect(lpTokenRewarder.addPool(lpToken.address, 200, true, overrides)).to.be.revertedWith('LR69')
  })

  it('adds LP pool', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken, other } = await loadFixture(lpTokenRewarderL1Fixture)
    const totalAllocationPointsBefore = await lpTokenRewarder.totalAllocationPoints()
    const pid = 0

    // Act & Assert
    await expect(lpTokenRewarder.addPool(lpToken.address, 100, true, overrides)).to.emit(lpTokenRewarder, 'PoolAdded')
    await expect(lpTokenRewarder.connect(other).addPool(lpToken.address, 200, true, overrides)).to.be.revertedWith(
      'LR00'
    )
    const totalAllocationPointsAfter = await lpTokenRewarder.totalAllocationPoints()
    expect((await lpTokenRewarder.pools(pid)).allocationPoints.add(totalAllocationPointsBefore)).to.eq(
      totalAllocationPointsAfter
    )
    expect(await lpTokenRewarder.addedLpTokens(lpToken.address)).to.eq(true)
    expect(await lpTokenRewarder.poolCount()).to.eq(1)
  })

  it('adds 2 LP pools', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken, otherLpToken } = await loadFixture(lpTokenRewarderL2Fixture)

    // Act & Assert
    await expect(lpTokenRewarder.addPool(lpToken.address, 100, true, overrides))
      .to.emit(lpTokenRewarder, 'PoolAdded')
      .withArgs(0, lpToken.address, 100)
    await expect(lpTokenRewarder.addPool(otherLpToken.address, 200, true, overrides))
      .to.emit(lpTokenRewarder, 'PoolAdded')
      .withArgs(1, otherLpToken.address, 200)
    expect(await lpTokenRewarder.totalAllocationPoints()).to.eq(300)
    expect(await lpTokenRewarder.addedLpTokens(lpToken.address)).to.eq(true)
    expect(await lpTokenRewarder.addedLpTokens(otherLpToken.address)).to.eq(true)
    expect(await lpTokenRewarder.poolCount()).to.eq(2)
  })
})

describe('TwapLPTokenRewarderL2.addPool', () => {
  const loadFixture = setupFixtureLoader()

  it('fails to add already existing LP pool', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken } = await loadFixture(lpTokenRewarderL2Fixture)

    // Act
    await lpTokenRewarder.addPool(lpToken.address, 100, true)

    // Assert
    await expect(lpTokenRewarder.addPool(lpToken.address, 200, true, overrides)).to.be.revertedWith('LR69')
  })

  it('adds LP pool', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken, other } = await loadFixture(lpTokenRewarderL2Fixture)
    const totalAllocationPointsBefore = await lpTokenRewarder.totalAllocationPoints()
    const pid = 0

    // Act & Assert
    await expect(lpTokenRewarder.addPool(lpToken.address, 100, true, overrides)).to.emit(lpTokenRewarder, 'PoolAdded')
    await expect(lpTokenRewarder.connect(other).addPool(lpToken.address, 200, true, overrides)).to.be.revertedWith(
      'LR00'
    )
    const totalAllocationPointsAfter = await lpTokenRewarder.totalAllocationPoints()
    expect((await lpTokenRewarder.pools(pid)).allocationPoints.add(totalAllocationPointsBefore)).to.eq(
      totalAllocationPointsAfter
    )
    expect(await lpTokenRewarder.addedLpTokens(lpToken.address)).to.eq(true)
    expect(await lpTokenRewarder.poolCount()).to.eq(1)
  })

  it('adds 2 LP pools', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken, otherLpToken } = await loadFixture(lpTokenRewarderL2Fixture)

    // Act & Assert
    await expect(lpTokenRewarder.addPool(lpToken.address, 100, true, overrides))
      .to.emit(lpTokenRewarder, 'PoolAdded')
      .withArgs(0, lpToken.address, 100)
    await expect(lpTokenRewarder.addPool(otherLpToken.address, 200, true, overrides))
      .to.emit(lpTokenRewarder, 'PoolAdded')
      .withArgs(1, otherLpToken.address, 200)
    expect(await lpTokenRewarder.totalAllocationPoints()).to.eq(300)
    expect(await lpTokenRewarder.addedLpTokens(lpToken.address)).to.eq(true)
    expect(await lpTokenRewarder.addedLpTokens(otherLpToken.address)).to.eq(true)
    expect(await lpTokenRewarder.poolCount()).to.eq(2)
  })
})
