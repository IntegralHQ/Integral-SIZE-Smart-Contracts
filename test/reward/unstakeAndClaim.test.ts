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

describe('TwapLPTokenRewarderL1.unstakeAndClaim', () => {
  const loadFixture = setupFixtureLoader()

  it('fails to unstake and claim from non-existent pool', async () => {
    // Arrange
    const { lpTokenRewarder, other } = await loadFixture(lpTokenRewarderL1Fixture)
    const pid = 1

    // Act & Assert
    await expect(lpTokenRewarder.connect(other).unstakeAndClaim(pid, 0, other.address, overrides)).to.revertedWith('')
  })

  it('fails to unstake amount greater that staked amount', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken, other } = await loadFixture(lpTokenRewarderL1WithOnePoolFixture)
    const pid = 0
    const userBalance = expandTo18Decimals(10)
    const amountToStake = expandTo18Decimals(3)
    const amountToUnstake = expandTo18Decimals(5)

    // Act
    await lpToken.transfer(other.address, userBalance)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)
    await lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)

    // Assert
    await expect(
      lpTokenRewarder.connect(other).unstakeAndClaim(pid, amountToUnstake, other.address, overrides)
    ).to.revertedWith('SM12')
  })

  it('stake then unstake and claim reward', async () => {
    // Arrange
    const { lpTokenRewarder, rewardToken, lpToken, other } = await loadFixture(lpTokenRewarderL1WithOnePoolFixture)
    const amountToStake = expandTo18Decimals(10)
    const amountToUnstake = expandTo18Decimals(5)
    const pid = 0
    const rewardTokenAmountToTransfer = expandTo18Decimals(10000)
    await rewardToken.transfer(lpTokenRewarder.address, rewardTokenAmountToTransfer)
    await lpToken.transfer(other.address, amountToStake)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)

    // Act
    await lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)
    await (lpTokenRewarder.provider as providers.JsonRpcProvider).send('evm_increaseTime', [60])

    // Assert
    await expect(lpTokenRewarder.connect(other).unstakeAndClaim(pid, amountToUnstake, other.address, overrides))
      .to.emit(lpTokenRewarder, 'Unstaked')
      .withArgs(other.address, pid, amountToUnstake, other.address)
      .to.emit(lpTokenRewarder, 'Claimed')
    expect(await lpToken.balanceOf(lpTokenRewarder.address)).to.eq(amountToStake.sub(amountToUnstake))
    expect(await lpToken.balanceOf(other.address)).to.eq(amountToUnstake)
    expect((await lpTokenRewarder.users(pid, other.address)).lpAmount).to.eq(amountToStake.sub(amountToUnstake))
    expect((await rewardToken.balanceOf(other.address)).gt(0)).to.eq(true)
  })

  it('stake then unstake and claim reward immediately', async () => {
    // Arrange
    const { lpTokenRewarder, rewardToken, lpToken, other } = await loadFixture(lpTokenRewarderL2WithOnePoolFixture)
    const amountToStake = expandTo18Decimals(10)
    const amountToUnstake = expandTo18Decimals(5)
    const pid = 0
    const rewardTokenAmountToTransfer = expandTo18Decimals(10000)
    await rewardToken.transfer(lpTokenRewarder.address, rewardTokenAmountToTransfer)
    await lpToken.transfer(other.address, amountToStake)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)

    const rewardTokenBalanceBefore = await rewardToken.balanceOf(other.address)

    // Act
    // Disable automining
    await (lpTokenRewarder.provider as providers.JsonRpcProvider).send('evm_setAutomine', [false])
    await (lpTokenRewarder.provider as providers.JsonRpcProvider).send('evm_setIntervalMining', [0])

    await lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)
    await lpTokenRewarder.connect(other).unstakeAndClaim(pid, amountToUnstake, other.address, overrides)

    await (lpTokenRewarder.provider as providers.JsonRpcProvider).send('evm_mine', [])
    const rewardTokenBalanceAfter = await rewardToken.balanceOf(other.address)

    // Assert
    expect(rewardTokenBalanceAfter.sub(rewardTokenBalanceBefore)).equal(0)
  })
})

describe('TwapLPTokenRewarderL2.unstakeAndClaim', () => {
  const loadFixture = setupFixtureLoader()

  it('fails to unstake and claim from non-existent pool', async () => {
    // Arrange
    const { lpTokenRewarder, other } = await loadFixture(lpTokenRewarderL2Fixture)
    const pid = 1

    // Act & Assert
    await expect(lpTokenRewarder.connect(other).unstakeAndClaim(pid, 0, other.address, overrides)).to.revertedWith('')
  })

  it('fails to unstake amount greater that staked amount', async () => {
    // Arrange
    const { lpTokenRewarder, lpToken, other } = await loadFixture(lpTokenRewarderL2WithOnePoolFixture)
    const pid = 0
    const userBalance = expandTo18Decimals(10)
    const amountToStake = expandTo18Decimals(3)
    const amountToUnstake = expandTo18Decimals(5)

    // Act
    await lpToken.transfer(other.address, userBalance)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)
    await lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)

    // Assert
    await expect(
      lpTokenRewarder.connect(other).unstakeAndClaim(pid, amountToUnstake, other.address, overrides)
    ).to.revertedWith('SM12')
  })

  it('stake then unstake and claim reward', async () => {
    // Arrange
    const { lpTokenRewarder, rewardToken, lpToken, other } = await loadFixture(lpTokenRewarderL2WithOnePoolFixture)
    const amountToStake = expandTo18Decimals(10)
    const amountToUnstake = expandTo18Decimals(5)
    const pid = 0
    const rewardTokenAmountToTransfer = expandTo18Decimals(10000)
    await rewardToken.transfer(lpTokenRewarder.address, rewardTokenAmountToTransfer)
    await lpToken.transfer(other.address, amountToStake)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)

    // Act
    await lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)
    await (lpTokenRewarder.provider as providers.JsonRpcProvider).send('evm_increaseTime', [60])

    // Assert
    await expect(lpTokenRewarder.connect(other).unstakeAndClaim(pid, amountToUnstake, other.address, overrides))
      .to.emit(lpTokenRewarder, 'Unstaked')
      .withArgs(other.address, pid, amountToUnstake, other.address)
      .to.emit(lpTokenRewarder, 'Claimed')
    expect(await lpToken.balanceOf(lpTokenRewarder.address)).to.eq(amountToStake.sub(amountToUnstake))
    expect(await lpToken.balanceOf(other.address)).to.eq(amountToUnstake)
    expect((await lpTokenRewarder.users(pid, other.address)).lpAmount).to.eq(amountToStake.sub(amountToUnstake))
    expect((await rewardToken.balanceOf(other.address)).gt(0)).to.eq(true)
    expect((await rewardToken.balanceOf(lpTokenRewarder.address)).lt(rewardTokenAmountToTransfer)).to.eq(true)
  })

  it('stake then unstake and claim reward immediately', async () => {
    // Arrange
    const { lpTokenRewarder, rewardToken, lpToken, other } = await loadFixture(lpTokenRewarderL2WithOnePoolFixture)
    const amountToStake = expandTo18Decimals(10)
    const amountToUnstake = expandTo18Decimals(5)
    const pid = 0
    const rewardTokenAmountToTransfer = expandTo18Decimals(10000)
    await rewardToken.transfer(lpTokenRewarder.address, rewardTokenAmountToTransfer)
    await lpToken.transfer(other.address, amountToStake)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)

    const rewardTokenBalanceBefore = await rewardToken.balanceOf(other.address)

    // Act
    // Disable automining
    await (lpTokenRewarder.provider as providers.JsonRpcProvider).send('evm_setAutomine', [false])
    await (lpTokenRewarder.provider as providers.JsonRpcProvider).send('evm_setIntervalMining', [0])

    await lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)
    await lpTokenRewarder.connect(other).unstakeAndClaim(pid, amountToUnstake, other.address, overrides)

    await (lpTokenRewarder.provider as providers.JsonRpcProvider).send('evm_mine', [])
    const rewardTokenBalanceAfter = await rewardToken.balanceOf(other.address)

    // Assert
    expect(rewardTokenBalanceAfter.sub(rewardTokenBalanceBefore)).equal(0)
  })
})
