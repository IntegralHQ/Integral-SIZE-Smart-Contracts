import { expect } from 'chai'
import { lpTokenRewarderL2WithOnePoolFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, overrides } from '../shared/utilities'

describe('TwapLPTokenRewarderL2.stake', () => {
  const loadFixture = setupFixtureLoader()

  it('fails to withdraw ITGR from the rewarder contract', async () => {
    // Arrage
    const { lpTokenRewarder, other } = await loadFixture(lpTokenRewarderL2WithOnePoolFixture)

    // Act & Assert
    await expect(lpTokenRewarder.connect(other).withdraw(other.address, overrides)).to.be.revertedWith('LR00')
  })

  it('withdraws ITGR tokens', async () => {
    // Arrage
    const { lpTokenRewarder, other, rewardToken } = await loadFixture(lpTokenRewarderL2WithOnePoolFixture)
    const balanceBefore = await rewardToken.balanceOf(other.address)

    // Act
    const rewardTokenAmountToTransfer = expandTo18Decimals(10000)
    await rewardToken.transfer(lpTokenRewarder.address, rewardTokenAmountToTransfer)
    await lpTokenRewarder.withdraw(other.address, overrides)

    // Assert
    const balanceAfter = await rewardToken.balanceOf(other.address)
    expect(balanceAfter.sub(balanceBefore)).to.eq(rewardTokenAmountToTransfer)
  })
})
