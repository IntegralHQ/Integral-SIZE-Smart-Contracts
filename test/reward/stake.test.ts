import { expect } from 'chai'
import { lpTokenRewarderL1WithOnePoolFixture, lpTokenRewarderL2WithOnePoolFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, overrides } from '../shared/utilities'

describe('TwapLPTokenRewarderL1.stake', () => {
  const loadFixture = setupFixtureLoader()

  it('fails to stake LP tokens into non-existent pool', async () => {
    // Arrage
    const { lpTokenRewarder, other } = await loadFixture(lpTokenRewarderL1WithOnePoolFixture)
    const amountToStake = expandTo18Decimals(1)
    const nonexistentPid = 1

    // Act & Assert
    await expect(
      lpTokenRewarder.connect(other).stake(nonexistentPid, amountToStake, other.address, overrides)
    ).to.be.revertedWith('')
  })

  it('fails to stake LP tokens when staking is disabled', async () => {
    // Arrage
    const { lpTokenRewarder, other } = await loadFixture(lpTokenRewarderL1WithOnePoolFixture)
    const amountToStake = expandTo18Decimals(1)
    const pid = 0
    await lpTokenRewarder.setStakeDisabled(true, overrides)

    // Act & Assert
    await expect(lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)).to.be.revertedWith(
      'LR70'
    )
  })

  it('fails to stake more LP tokens than balance', async () => {
    // Arrage
    const { lpTokenRewarder, lpToken, other } = await loadFixture(lpTokenRewarderL1WithOnePoolFixture)
    const pid = 0
    const userBalance = expandTo18Decimals(10)
    const amountToStake = expandTo18Decimals(20)

    // Act
    await lpToken.transfer(other.address, userBalance)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)

    // Assert
    await expect(lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)).to.be.revertedWith(
      'TH0E'
    )
  })

  it('stakes LP token', async () => {
    // Arrage
    const { lpTokenRewarder, lpToken, other } = await loadFixture(lpTokenRewarderL1WithOnePoolFixture)
    const pid = 0
    const userBalance = expandTo18Decimals(10)
    const amountToStake = expandTo18Decimals(3)

    // Act
    await lpToken.transfer(other.address, userBalance)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)

    // Assert
    await expect(lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides))
      .to.emit(lpTokenRewarder, 'Staked')
      .withArgs(other.address, pid, amountToStake, other.address)

    expect((await lpTokenRewarder.users(pid, other.address)).lpAmount).to.eq(amountToStake)
    expect(await lpToken.balanceOf(other.address)).to.eq(userBalance.sub(amountToStake)) // check LP token balance of the user
    expect(await lpToken.balanceOf(lpTokenRewarder.address)).to.eq(amountToStake) // check LP token balance of the Rewarder contract
  })
})

describe('TwapLPTokenRewarderL2.stake', () => {
  const loadFixture = setupFixtureLoader()

  it('fails to stake LP tokens into non-existent pool', async () => {
    // Arrage
    const { lpTokenRewarder, other } = await loadFixture(lpTokenRewarderL2WithOnePoolFixture)
    const amountToStake = expandTo18Decimals(1)
    const nonexistentPid = 1

    // Act & Assert
    await expect(
      lpTokenRewarder.connect(other).stake(nonexistentPid, amountToStake, other.address, overrides)
    ).to.be.revertedWith('')
  })

  it('fails to stake more LP tokens than balance', async () => {
    // Arrage
    const { lpTokenRewarder, lpToken, other } = await loadFixture(lpTokenRewarderL2WithOnePoolFixture)
    const pid = 0
    const userBalance = expandTo18Decimals(10)
    const amountToStake = expandTo18Decimals(20)

    // Act
    await lpToken.transfer(other.address, userBalance)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)

    // Assert
    await expect(lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides)).to.be.revertedWith(
      'TH0E'
    )
  })

  it('stakes LP token', async () => {
    // Arrage
    const { lpTokenRewarder, lpToken, other } = await loadFixture(lpTokenRewarderL2WithOnePoolFixture)
    const pid = 0
    const userBalance = expandTo18Decimals(10)
    const amountToStake = expandTo18Decimals(3)

    // Act
    await lpToken.transfer(other.address, userBalance)
    await lpToken.connect(other).approve(lpTokenRewarder.address, amountToStake)

    // Assert
    await expect(lpTokenRewarder.connect(other).stake(pid, amountToStake, other.address, overrides))
      .to.emit(lpTokenRewarder, 'Staked')
      .withArgs(other.address, pid, amountToStake, other.address)

    expect((await lpTokenRewarder.users(pid, other.address)).lpAmount).to.eq(amountToStake)
    expect(await lpToken.balanceOf(other.address)).to.eq(userBalance.sub(amountToStake)) // check LP token balance of the user
    expect(await lpToken.balanceOf(lpTokenRewarder.address)).to.eq(amountToStake) // check LP token balance of the Rewarder contract
  })
})
