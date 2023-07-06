import { expect } from 'chai'
import {
  lpTokenRewarderL1Fixture,
  lpTokenRewarderL1WithOnePoolFixture,
  lpTokenRewarderL2Fixture,
  lpTokenRewarderL2WithOnePoolFixture,
} from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, overrides } from '../shared/utilities'

describe('TwapLPTokenRewarderL1.unstake', () => {
  const loadFixture = setupFixtureLoader()

  it('fails to unstake LP token from non-existent pool', async () => {
    // Arrange
    const { lpTokenRewarder, other } = await loadFixture(lpTokenRewarderL1Fixture)
    const amountToStake = expandTo18Decimals(1)
    const nonexistentPid = 1

    // Act & Assert
    await expect(
      lpTokenRewarder.connect(other).unstake(nonexistentPid, amountToStake, other.address, overrides)
    ).to.revertedWith('')
  })

  it('fails to unstake amount greater than staked amount', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken, other } = await loadFixture(lpTokenRewarderL1WithOnePoolFixture)
    const pid = 0
    const amountToStake = expandTo18Decimals(3)
    const amountToUnstake = expandTo18Decimals(5)

    // Act
    await lpToken.transfer(other.address, amountToStake)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)
    await lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)

    // Assert
    await expect(
      lpTokenRewarder.connect(other).unstake(pid, amountToUnstake, other.address, overrides)
    ).to.revertedWith('SM12')
  })

  it('unstakes LP token', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken, other } = await loadFixture(lpTokenRewarderL1WithOnePoolFixture)
    const userBalance = expandTo18Decimals(10)
    const amountToStake = expandTo18Decimals(5)
    const amountToUnstake = expandTo18Decimals(1)
    const pid = 0

    // Act
    await lpToken.transfer(other.address, userBalance)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)
    await lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)

    // Assert
    await expect(lpTokenRewarder.connect(other).unstake(pid, amountToUnstake, other.address, overrides))
      .to.emit(lpTokenRewarder, 'Unstaked')
      .withArgs(other.address, pid, amountToUnstake, other.address)

    expect((await lpTokenRewarder.users(pid, other.address)).lpAmount).to.eq(amountToStake.sub(amountToUnstake))
    expect(await lpToken.balanceOf(other.address)).to.eq(userBalance.sub(amountToStake).add(amountToUnstake)) // check LP token balance of user
    expect(await lpToken.balanceOf(lpTokenRewarder.address)).to.eq(amountToStake.sub(amountToUnstake)) // check LP token balance of Rewarder
  })

  it('unstakes all LP tokens and still can claim later', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken, other } = await loadFixture(lpTokenRewarderL1WithOnePoolFixture)
    const userBalance = expandTo18Decimals(10)
    const amountToStake = expandTo18Decimals(5)
    const amountToUnstake = amountToStake
    const pid = 0

    // Act
    await lpToken.transfer(other.address, userBalance)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)
    await lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)

    // Assert
    await expect(lpTokenRewarder.connect(other).unstake(pid, amountToUnstake, other.address, overrides))
      .to.emit(lpTokenRewarder, 'Unstaked')
      .withArgs(other.address, pid, amountToUnstake, other.address)

    expect((await lpTokenRewarder.users(pid, other.address)).lpAmount).to.eq(amountToStake.sub(amountToUnstake))
    expect(await lpToken.balanceOf(other.address)).to.eq(userBalance.sub(amountToStake).add(amountToUnstake)) // check LP token balance of user
    expect(await lpToken.balanceOf(lpTokenRewarder.address)).to.eq(amountToStake.sub(amountToUnstake)) // check LP token balance of Rewarder

    expect(await lpTokenRewarder.claimable(pid, other.address, overrides)).to.be.gt(0)
  })
})

describe('TwapLPTokenRewarderL2.unstake', () => {
  const loadFixture = setupFixtureLoader()

  it('fails to unstake LP token from non-existent pool', async () => {
    // Arrange
    const { lpTokenRewarder, other } = await loadFixture(lpTokenRewarderL2Fixture)
    const amountToStake = expandTo18Decimals(1)
    const nonexistentPid = 1

    // Act & Assert
    await expect(
      lpTokenRewarder.connect(other).unstake(nonexistentPid, amountToStake, other.address, overrides)
    ).to.revertedWith('')
  })

  it('fails to unstake amount greater than staked amount', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken, other } = await loadFixture(lpTokenRewarderL2WithOnePoolFixture)
    const pid = 0
    const amountToStake = expandTo18Decimals(3)
    const amountToUnstake = expandTo18Decimals(5)

    // Act
    await lpToken.transfer(other.address, amountToStake)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)
    await lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)

    // Assert
    await expect(
      lpTokenRewarder.connect(other).unstake(pid, amountToUnstake, other.address, overrides)
    ).to.revertedWith('SM12')
  })

  it('unstakes LP token', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken, other } = await loadFixture(lpTokenRewarderL2WithOnePoolFixture)
    const userBalance = expandTo18Decimals(10)
    const amountToStake = expandTo18Decimals(5)
    const amountToUnstake = expandTo18Decimals(1)
    const pid = 0

    // Act
    await lpToken.transfer(other.address, userBalance)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)
    await lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)

    // Assert
    await expect(lpTokenRewarder.connect(other).unstake(pid, amountToUnstake, other.address, overrides))
      .to.emit(lpTokenRewarder, 'Unstaked')
      .withArgs(other.address, pid, amountToUnstake, other.address)

    expect((await lpTokenRewarder.users(pid, other.address)).lpAmount).to.eq(amountToStake.sub(amountToUnstake))
    expect(await lpToken.balanceOf(other.address)).to.eq(userBalance.sub(amountToStake).add(amountToUnstake)) // check LP token balance of user
    expect(await lpToken.balanceOf(lpTokenRewarder.address)).to.eq(amountToStake.sub(amountToUnstake)) // check LP token balance of Rewarder
  })

  it('unstakes all LP tokens and still can claim later', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken, other } = await loadFixture(lpTokenRewarderL2WithOnePoolFixture)
    const userBalance = expandTo18Decimals(10)
    const amountToStake = expandTo18Decimals(5)
    const amountToUnstake = amountToStake
    const pid = 0

    // Act
    await lpToken.transfer(other.address, userBalance)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)
    await lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)

    // Assert
    await expect(lpTokenRewarder.connect(other).unstake(pid, amountToUnstake, other.address, overrides))
      .to.emit(lpTokenRewarder, 'Unstaked')
      .withArgs(other.address, pid, amountToUnstake, other.address)

    expect((await lpTokenRewarder.users(pid, other.address)).lpAmount).to.eq(amountToStake.sub(amountToUnstake))
    expect(await lpToken.balanceOf(other.address)).to.eq(userBalance.sub(amountToStake).add(amountToUnstake)) // check LP token balance of user
    expect(await lpToken.balanceOf(lpTokenRewarder.address)).to.eq(amountToStake.sub(amountToUnstake)) // check LP token balance of Rewarder

    expect(await lpTokenRewarder.claimable(pid, other.address, overrides)).to.be.gt(0)
  })
})
