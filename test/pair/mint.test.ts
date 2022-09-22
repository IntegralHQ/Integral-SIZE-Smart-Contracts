import { expect } from 'chai'
import { constants, BigNumber } from 'ethers'

import { expandTo18Decimals, overrides } from '../shared/utilities'
import { pairFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'

const MINIMUM_LIQUIDITY = BigNumber.from(10).pow(3)

describe('TwapPair.mint', () => {
  const loadFixture = setupFixtureLoader()

  it('emits events with correct values', async () => {
    const { factory, pair, token0, token1, MINT_FEE, PRECISION, wallet } = await loadFixture(pairFixture)

    const token0Amount = expandTo18Decimals(1)
    const token1Amount = expandTo18Decimals(4)
    await token0.transfer(pair.address, token0Amount, overrides)
    await token1.transfer(pair.address, token1Amount, overrides)

    const expectedLiquidity = expandTo18Decimals(2)
    const expectedFee = expectedLiquidity.sub(MINIMUM_LIQUIDITY).mul(MINT_FEE).div(PRECISION)
    const mintedLiquidity = expectedLiquidity.sub(MINIMUM_LIQUIDITY).sub(expectedFee)

    await expect(pair.mint(wallet.address, overrides))
      .to.emit(pair, 'Transfer')
      .withArgs(constants.AddressZero, constants.AddressZero, MINIMUM_LIQUIDITY)
      .to.emit(pair, 'Transfer')
      .withArgs(constants.AddressZero, wallet.address, mintedLiquidity)
      .to.emit(pair, 'Transfer')
      .withArgs(constants.AddressZero, factory.address, expectedFee)
      .to.emit(pair, 'Mint')
      .withArgs(wallet.address, token0Amount, token1Amount, mintedLiquidity, wallet.address)

    expect(await pair.totalSupply()).to.eq(expectedLiquidity)
    expect(await pair.balanceOf(wallet.address)).to.eq(mintedLiquidity)
    expect(await pair.balanceOf(factory.address)).to.eq(expectedFee)
    expect(await token0.balanceOf(pair.address)).to.eq(token0Amount)
    expect(await token1.balanceOf(pair.address)).to.eq(token1Amount)
    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(token0Amount)
    expect(reserves[1]).to.eq(token1Amount)
  })

  it('applies the fee', async () => {
    const { pair, token0, addLiquidity, SWAP_FEE_N, MINT_FEE, getState, PRECISION, wallet, setupUniswapPair } =
      await loadFixture(pairFixture)

    await addLiquidity(expandTo18Decimals(500), expandTo18Decimals(500))
    const { priceInfo } = await setupUniswapPair(1)

    await token0.transfer(pair.address, expandTo18Decimals(50), overrides)
    const swapFee = expandTo18Decimals(50 * SWAP_FEE_N)
    const swapOutput = 50 * (1 - SWAP_FEE_N)
    await pair.swap(0, expandTo18Decimals(swapOutput), wallet.address, priceInfo, overrides)

    const amount0 = 550 * 0.2
    const amount1 = (500 - swapOutput) * 0.2

    const before = await getState()
    await addLiquidity(expandTo18Decimals(amount0), expandTo18Decimals(amount1))
    const after = await getState()

    const liquidityDifference = before.totalLiquidity.mul(2).div(10)
    const liquidityFee = liquidityDifference.mul(MINT_FEE).div(PRECISION)

    expect(after.walletLiquidity.sub(before.walletLiquidity)).to.equal(liquidityDifference.sub(liquidityFee))
    expect(after.factoryLiquidity.sub(before.factoryLiquidity)).to.equal(liquidityFee)

    expect(after.reserves[0]).to.equal(expandTo18Decimals(550 + amount0).sub(swapFee))
    expect(after.reserves[1]).to.equal(
      expandTo18Decimals(500).sub(expandTo18Decimals(swapOutput)).add(expandTo18Decimals(amount1))
    )

    expect(after.fees[0]).to.equal(expandTo18Decimals(50 * SWAP_FEE_N))
    expect(after.fees[1]).to.equal(0)
  })

  it('reverts if to is zero', async () => {
    const { pair } = await loadFixture(pairFixture)
    await expect(pair.mint(constants.AddressZero, overrides)).to.revertedWith('TP02')
  })
})
