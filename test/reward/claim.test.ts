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

describe('TwapLPTokenRewarderL1.claim', () => {
  const loadFixture = setupFixtureLoader()

  it('fails to claim reward from non-existent LP pool', async () => {
    // Arrange
    const { lpTokenRewarder, other } = await loadFixture(lpTokenRewarderL1Fixture)
    const pid = 1

    // Act & Assert
    await expect(lpTokenRewarder.connect(other).claim(pid, other.address, overrides)).to.be.revertedWith('')
  })

  it('claims reward', async () => {
    // Arrange
    const { lpTokenRewarder, rewardToken, lpToken, other } = await loadFixture(lpTokenRewarderL1WithOnePoolFixture)
    const amountToStake = expandTo18Decimals(10)
    const pid = 0
    const rewardTokenAmountToTransfer = expandTo18Decimals(10000)
    await rewardToken.transfer(lpTokenRewarder.address, rewardTokenAmountToTransfer)
    await lpToken.transfer(other.address, amountToStake)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)

    // Act
    await lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)
    await (lpTokenRewarder.provider as providers.JsonRpcProvider).send('evm_increaseTime', [60])

    // Assert
    await expect(lpTokenRewarder.connect(other).claim(pid, other.address, overrides)).to.emit(
      lpTokenRewarder,
      'Claimed'
    )
    expect(await lpToken.balanceOf(lpTokenRewarder.address)).to.eq(amountToStake)
    expect((await lpTokenRewarder.users(pid, other.address)).lpAmount).to.eq(amountToStake)
    expect((await rewardToken.balanceOf(other.address)).gt(0)).to.eq(true)
  })

  it('claims rewards for 2 users', async () => {
    // Arrange
    const { lpTokenRewarder, rewardToken, lpToken, other, another } = await loadFixture(
      lpTokenRewarderL1WithOnePoolFixture
    )
    const amountToStake = expandTo18Decimals(10)
    const pid = 0
    const rewardTokenAmountToTransfer = expandTo18Decimals(10000)
    await rewardToken.transfer(lpTokenRewarder.address, rewardTokenAmountToTransfer)
    await lpToken.transfer(other.address, amountToStake)
    await lpToken.transfer(another.address, amountToStake)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)
    await lpToken.connect(another).approve(lpTokenRewarder.address, amountToStake)

    // Act
    await lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)
    await lpTokenRewarder.connect(another).stake(pid, amountToStake, another.address, overrides)
    await (lpTokenRewarder.provider as providers.JsonRpcProvider).send('evm_increaseTime', [60])

    // Assert
    expect(await rewardToken.balanceOf(other.address)).to.eq(0)
    expect(await rewardToken.balanceOf(another.address)).to.eq(0)

    await expect(lpTokenRewarder.connect(other).claim(pid, other.address, overrides)).to.emit(
      lpTokenRewarder,
      'Claimed'
    )
    await expect(lpTokenRewarder.connect(another).claim(pid, another.address, overrides)).to.emit(
      lpTokenRewarder,
      'Claimed'
    )

    expect(await rewardToken.balanceOf(other.address)).to.be.gt(0)
    expect(await rewardToken.balanceOf(another.address)).to.be.gt(0)
    expect((await lpTokenRewarder.users(pid, other.address)).lpAmount).to.eq(amountToStake)
    expect((await lpTokenRewarder.users(pid, another.address)).lpAmount).to.eq(amountToStake)
  })
})

describe('TwapLPTokenRewarderL2.claim', () => {
  const loadFixture = setupFixtureLoader()

  it('fails to claim reward from non-existent LP pool', async () => {
    // Arrange
    const { lpTokenRewarder, other } = await loadFixture(lpTokenRewarderL2Fixture)
    const pid = 1

    // Act & Assert
    await expect(lpTokenRewarder.connect(other).claim(pid, other.address, overrides)).to.be.revertedWith('')
  })

  it('claims reward', async () => {
    // Arrange
    const { lpTokenRewarder, rewardToken, lpToken, other } = await loadFixture(lpTokenRewarderL2WithOnePoolFixture)
    const amountToStake = expandTo18Decimals(10)
    const pid = 0
    const rewardTokenAmountToTransfer = expandTo18Decimals(10000)
    await rewardToken.transfer(lpTokenRewarder.address, rewardTokenAmountToTransfer)
    await lpToken.transfer(other.address, amountToStake)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)
    const itgrPerSecond = await lpTokenRewarder.itgrPerSecond()

    // Act
    await lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)
    const timestampBefore = (await lpTokenRewarder.pools(pid)).lastRewardTimestamp
    await (lpTokenRewarder.provider as providers.JsonRpcProvider).send('evm_increaseTime', [60])

    // Assert
    await expect(lpTokenRewarder.connect(other).claim(pid, other.address, overrides)).to.emit(
      lpTokenRewarder,
      'Claimed'
    )
    const timestampAfter = (await lpTokenRewarder.pools(pid)).lastRewardTimestamp
    expect(await lpToken.balanceOf(lpTokenRewarder.address)).to.eq(amountToStake)
    expect((await lpTokenRewarder.users(pid, other.address)).lpAmount).to.eq(amountToStake)
    expect((await rewardToken.balanceOf(lpTokenRewarder.address)).lt(rewardTokenAmountToTransfer)).to.eq(true)
    expect(await rewardToken.balanceOf(other.address)).to.eq(itgrPerSecond.mul(timestampAfter.sub(timestampBefore)))
  })

  it('claims rewards for 2 users', async () => {
    // Arrange
    const { lpTokenRewarder, rewardToken, lpToken, other, another } = await loadFixture(
      lpTokenRewarderL2WithOnePoolFixture
    )
    const amountToStake = expandTo18Decimals(10)
    const pid = 0
    const rewardTokenAmountToTransfer = expandTo18Decimals(10000)
    await rewardToken.transfer(lpTokenRewarder.address, rewardTokenAmountToTransfer)
    await lpToken.transfer(other.address, amountToStake)
    await lpToken.transfer(another.address, amountToStake)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)
    await lpToken.connect(another).approve(lpTokenRewarder.address, amountToStake)
    const rewarderBalanceBefore = await rewardToken.balanceOf(lpTokenRewarder.address)

    // Act
    await lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)
    await lpTokenRewarder.connect(another).stake(pid, amountToStake, another.address, overrides)
    await (lpTokenRewarder.provider as providers.JsonRpcProvider).send('evm_increaseTime', [60])

    // Assert
    expect(await rewardToken.balanceOf(other.address)).to.eq(0)
    expect(await rewardToken.balanceOf(another.address)).to.eq(0)

    await expect(lpTokenRewarder.connect(other).claim(pid, other.address, overrides)).to.emit(
      lpTokenRewarder,
      'Claimed'
    )
    await expect(lpTokenRewarder.connect(another).claim(pid, another.address, overrides)).to.emit(
      lpTokenRewarder,
      'Claimed'
    )
    const [otherBalanceAfter, anotherBalanceAfter, rewarderBalanceAfter] = [
      await rewardToken.balanceOf(other.address),
      await rewardToken.balanceOf(another.address),
      await rewardToken.balanceOf(lpTokenRewarder.address),
    ]

    expect(otherBalanceAfter).to.be.gt(0)
    expect(anotherBalanceAfter).to.be.gt(0)
    expect((await lpTokenRewarder.users(pid, other.address)).lpAmount).to.eq(amountToStake)
    expect((await lpTokenRewarder.users(pid, another.address)).lpAmount).to.eq(amountToStake)
    expect(rewarderBalanceBefore.sub(rewarderBalanceAfter)).to.eq(otherBalanceAfter.add(anotherBalanceAfter))
  })
})
