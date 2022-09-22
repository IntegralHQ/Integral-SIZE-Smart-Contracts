import { expect } from 'chai'
import { constants, BigNumber } from 'ethers'

import { expandTo18Decimals, overrides } from '../shared/utilities'
import { pairFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'

const MINIMUM_LIQUIDITY = BigNumber.from(10).pow(3)

describe('TwapPair.burn', () => {
  const loadFixture = setupFixtureLoader()

  it('emits events with correct values', async () => {
    const { factory, token0, token1, pair, addLiquidity, BURN_FEE, PRECISION, wallet } = await loadFixture(pairFixture)

    const token0Amount = expandTo18Decimals(3)
    const token1Amount = expandTo18Decimals(3)
    await addLiquidity(token0Amount, token1Amount)

    const walletLiquidity = await pair.balanceOf(wallet.address)
    const factoryLiquidity = await pair.balanceOf(factory.address)
    const feeLiquidity = walletLiquidity.mul(BURN_FEE).div(PRECISION)
    const effectiveWalletLiquidity = walletLiquidity.sub(feeLiquidity)

    const expectedToken0Out = effectiveWalletLiquidity.mul(token0Amount).div(expandTo18Decimals(3))
    const expectedToken1Out = effectiveWalletLiquidity.mul(token1Amount).div(expandTo18Decimals(3))

    await pair.transfer(pair.address, walletLiquidity, overrides)
    await expect(pair.burn(wallet.address, overrides))
      .to.emit(pair, 'Transfer')
      .withArgs(pair.address, constants.AddressZero, effectiveWalletLiquidity)
      .to.emit(pair, 'Transfer')
      .withArgs(pair.address, factory.address, feeLiquidity)
      .to.emit(token0, 'Transfer')
      .withArgs(pair.address, wallet.address, expectedToken0Out)
      .to.emit(token1, 'Transfer')
      .withArgs(pair.address, wallet.address, expectedToken1Out)
      .to.emit(pair, 'Burn')
      .withArgs(wallet.address, expectedToken0Out, expectedToken1Out, effectiveWalletLiquidity, wallet.address)

    expect(await pair.balanceOf(wallet.address)).to.eq(0)
    expect(await pair.balanceOf(factory.address)).to.eq(factoryLiquidity.add(feeLiquidity))
    expect(await pair.totalSupply()).to.eq(factoryLiquidity.add(MINIMUM_LIQUIDITY).add(feeLiquidity))
    expect(await token0.balanceOf(pair.address)).to.eq(expandTo18Decimals(3).sub(expectedToken0Out))
    expect(await token1.balanceOf(pair.address)).to.eq(expandTo18Decimals(3).sub(expectedToken1Out))
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    expect(await token0.balanceOf(wallet.address)).to.eq(
      totalSupplyToken0.sub(expandTo18Decimals(3)).add(expectedToken0Out)
    )
    expect(await token1.balanceOf(wallet.address)).to.eq(
      totalSupplyToken1.sub(expandTo18Decimals(3)).add(expectedToken1Out)
    )
  })

  it('applies the fee', async () => {
    const { token0, pair, addLiquidity, setupUniswapPair, SWAP_FEE, BURN_FEE, getState, PRECISION, wallet } =
      await loadFixture(pairFixture)

    const token0Amount = expandTo18Decimals(500)
    const token1Amount = expandTo18Decimals(500)
    await addLiquidity(token0Amount, token1Amount)

    await token0.transfer(pair.address, expandTo18Decimals(50), overrides)
    const swapFee = expandTo18Decimals(50).mul(SWAP_FEE).div(PRECISION)
    const { priceInfo } = await setupUniswapPair(1)
    await pair.swap(0, expandTo18Decimals(50).sub(swapFee), wallet.address, priceInfo, overrides)

    const beforeState = await getState()
    await pair.transfer(pair.address, expandTo18Decimals(100), overrides)
    await pair.burn(wallet.address, overrides)
    const afterState = await getState()

    const burnFee = expandTo18Decimals(100).mul(BURN_FEE).div(PRECISION)
    const effectiveLiquidity = expandTo18Decimals(100).sub(burnFee)
    expect(beforeState.walletLiquidity.sub(afterState.walletLiquidity)).to.eq(expandTo18Decimals(100))
    expect(afterState.factoryLiquidity.sub(beforeState.factoryLiquidity)).to.eq(burnFee)
    expect(beforeState.totalLiquidity.sub(afterState.totalLiquidity)).to.eq(effectiveLiquidity)

    const amount0Out = effectiveLiquidity.mul(beforeState.reserves[0]).div(beforeState.totalLiquidity)
    const amount1Out = effectiveLiquidity.mul(beforeState.reserves[1]).div(beforeState.totalLiquidity)

    expect(afterState.walletToken0Balance.sub(beforeState.walletToken0Balance)).to.eq(amount0Out)
    expect(afterState.walletToken1Balance.sub(beforeState.walletToken1Balance)).to.eq(amount1Out)

    expect(beforeState.reserves[0].sub(afterState.reserves[0])).to.eq(amount0Out)
    expect(beforeState.reserves[1].sub(afterState.reserves[1])).to.eq(amount1Out)
  })

  it('reverts if to is zero', async () => {
    const { pair } = await loadFixture(pairFixture)
    await expect(pair.burn(constants.AddressZero, overrides)).to.be.revertedWith('TP02')
  })

  it('reverts if total supply is zero', async () => {
    const { pair, other } = await loadFixture(pairFixture)
    await expect(pair.burn(other.address, overrides)).to.be.revertedWith('TP36')
  })
})
