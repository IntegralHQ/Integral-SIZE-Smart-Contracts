import { expect } from 'chai'
import { providers } from 'ethers'
import {
  lpTokenRewarderL1Fixture,
  lpTokenRewarderL1WithOnePoolFixture,
  lpTokenRewarderL2Fixture,
  lpTokenRewarderL2WithOnePoolFixture,
} from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, overrides } from '../shared/utilities'

describe('TwapLPTokenRewarderL1.claimable', () => {
  const loadFixture = setupFixtureLoader()

  it('fails to get claimable ITGR reward for non-existent pool', async () => {
    // Arrange
    const { lpTokenRewarder, other } = await loadFixture(lpTokenRewarderL1Fixture)
    const nonexistentPoolId = 1

    // Act & Assert
    await expect(lpTokenRewarder.claimable(nonexistentPoolId, other.address, overrides)).to.be.revertedWith('')
  })

  it('gets claimable reward', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken, other } = await loadFixture(lpTokenRewarderL1WithOnePoolFixture)
    const amountToStake = expandTo18Decimals(10)
    const pid = 0
    await lpToken.transfer(other.address, amountToStake)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)
    await lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)
    await (lpTokenRewarder.provider as providers.JsonRpcProvider).send('evm_mine', [])

    // Act & Assert
    expect((await lpTokenRewarder.claimable(pid, other.address)).gt(0)).to.be.true
  })
})

describe('TwapLPTokenRewarderL2.claimable', () => {
  const loadFixture = setupFixtureLoader()

  it('fails to get claimable ITGR reward for non-existent pool', async () => {
    // Arrange
    const { lpTokenRewarder, other } = await loadFixture(lpTokenRewarderL2Fixture)
    const nonexistentPoolId = 1

    // Act & Assert
    await expect(lpTokenRewarder.claimable(nonexistentPoolId, other.address, overrides)).to.be.revertedWith('')
  })

  it('gets claimable reward', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken, other } = await loadFixture(lpTokenRewarderL2WithOnePoolFixture)
    const amountToStake = expandTo18Decimals(10)
    const pid = 0
    await lpToken.transfer(other.address, amountToStake)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)
    await lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)
    await (lpTokenRewarder.provider as providers.JsonRpcProvider).send('evm_mine', [])

    // Act & Assert
    expect((await lpTokenRewarder.claimable(pid, other.address)).gt(0)).to.be.true
  })
})
