import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { relayerFixture } from '../shared/fixtures/relayerFixture'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, overrides } from '../shared/utilities'

describe('TwapRelayer.getPoolState', () => {
  const loadFixture = setupFixtureLoader()

  it('should return correct state - token with 18 decimals ', async () => {
    const RelayerEnv = await loadFixture(relayerFixture)
    const { token, weth, wethPair, relayer, configureForSwapping } = RelayerEnv
    await configureForSwapping()

    const wethPairToken0 = token
    const wethPairToken1 = weth

    const wethPairSwapFee = BigNumber.from(1001)
    const wethPairToken0MinLimit = BigNumber.from(1)
    const wethPairToken1MinLimit = BigNumber.from(2)
    const wethPairToken0MaxLimit = expandTo18Decimals(0.8123)
    const wethPairToken1MaxLimit = expandTo18Decimals(0.8234)

    await relayer.setSwapFee(wethPair.address, wethPairSwapFee, overrides)
    await relayer.setTokenLimitMin(wethPairToken0.address, wethPairToken0MinLimit, overrides)
    await relayer.setTokenLimitMaxMultiplier(wethPairToken0.address, wethPairToken0MaxLimit, overrides)
    await relayer.setTokenLimitMin(wethPairToken1.address, wethPairToken1MinLimit, overrides)
    await relayer.setTokenLimitMaxMultiplier(wethPairToken1.address, wethPairToken1MaxLimit, overrides)

    const stateWethPair = await relayer.getPoolState(wethPairToken0.address, wethPairToken1.address)

    const wethPairToken0Balance = await wethPairToken0.balanceOf(relayer.address)
    const wethPairToken1Balance = await wethPairToken1.balanceOf(relayer.address)

    const expectedWethPairLimitMax0 = wethPairToken0Balance.mul(wethPairToken0MaxLimit).div(expandTo18Decimals(1))
    const expectedWethPairLimitMax1 = wethPairToken1Balance.mul(wethPairToken1MaxLimit).div(expandTo18Decimals(1))

    expect(stateWethPair.fee.eq(wethPairSwapFee)).to.be.true
    expect(stateWethPair.limitMin0.eq(wethPairToken0MinLimit)).to.be.true
    expect(stateWethPair.limitMax0.eq(expectedWethPairLimitMax0)).to.be.true
    expect(stateWethPair.limitMin1.eq(wethPairToken1MinLimit)).to.be.true
    expect(stateWethPair.limitMax1.eq(expectedWethPairLimitMax1)).to.be.true
  })

  it('should return correct state - token with 6 decimals', async () => {
    const RelayerEnv = await loadFixture(relayerFixture)
    const { token6decimals, weth, wethPair6decimals, relayer, configureForSwapping } = RelayerEnv
    await configureForSwapping()

    const wethPair6decimalsToken0 = weth
    const wethPair6decimalsToken1 = token6decimals

    const wethPair6decimalsSwapFee = BigNumber.from(1002)
    const wethPair6decimalsToken0MinLimit = BigNumber.from(2)
    const wethPair6decimalsToken1MinLimit = BigNumber.from(3)
    const wethPair6decimalsToken0MaxLimit = expandTo18Decimals(0.8234)
    const wethPair6decimalsToken1MaxLimit = expandTo18Decimals(0.8345)

    await relayer.setSwapFee(wethPair6decimals.address, wethPair6decimalsSwapFee, overrides)
    await relayer.setTokenLimitMin(wethPair6decimalsToken0.address, wethPair6decimalsToken0MinLimit, overrides)
    await relayer.setTokenLimitMaxMultiplier(
      wethPair6decimalsToken0.address,
      wethPair6decimalsToken0MaxLimit,
      overrides
    )
    await relayer.setTokenLimitMin(wethPair6decimalsToken1.address, wethPair6decimalsToken1MinLimit, overrides)
    await relayer.setTokenLimitMaxMultiplier(
      wethPair6decimalsToken1.address,
      wethPair6decimalsToken1MaxLimit,
      overrides
    )

    const stateWethPair6decimals = await relayer.getPoolState(
      wethPair6decimalsToken0.address,
      wethPair6decimalsToken1.address
    )

    const wethPair6decimalsToken0Balance = await wethPair6decimalsToken0.balanceOf(relayer.address)
    const wethPair6decimalsToken1Balance = await wethPair6decimalsToken1.balanceOf(relayer.address)

    const expectedWethPair6decimalsLimitMax0 = wethPair6decimalsToken0Balance
      .mul(wethPair6decimalsToken0MaxLimit)
      .div(expandTo18Decimals(1))
    const expectedWethPair6decimalsLimitMax1 = wethPair6decimalsToken1Balance
      .mul(wethPair6decimalsToken1MaxLimit)
      .div(expandTo18Decimals(1))

    expect(stateWethPair6decimals.fee.eq(wethPair6decimalsSwapFee)).to.be.true
    expect(stateWethPair6decimals.limitMin0.eq(wethPair6decimalsToken0MinLimit)).to.be.true
    expect(stateWethPair6decimals.limitMax0.eq(expectedWethPair6decimalsLimitMax0)).to.be.true
    expect(stateWethPair6decimals.limitMin1.eq(wethPair6decimalsToken1MinLimit)).to.be.true
    expect(stateWethPair6decimals.limitMax1.eq(expectedWethPair6decimalsLimitMax1)).to.be.true
  })

  it('should revert if pair is not enabled', async () => {
    const RelayerEnv = await loadFixture(relayerFixture)
    const { token, weth, relayer, configureForSwapping } = RelayerEnv
    const skipPairEnabled = true
    await configureForSwapping(skipPairEnabled)

    const wethPairToken0 = token
    const wethPairToken1 = weth

    await expect(relayer.getPoolState(wethPairToken0.address, wethPairToken1.address)).to.be.revertedWith('TR5A')
  })
})
