import { expect } from 'chai'

import { expandTo18Decimals, overrides } from '../shared/utilities'
import { pairFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'

describe('TwapPair.setBurnFee', () => {
  const loadFixture = setupFixtureLoader()

  it('can only be called by the factory', async () => {
    const { pair } = await loadFixture(pairFixture)
    await expect(pair.setBurnFee(1111, overrides)).to.be.revertedWith('TP00')
  })

  it('cannot be set to same value', async () => {
    const { pair, factory, token0, token1 } = await loadFixture(pairFixture)
    const fee = await pair.burnFee()
    await expect(factory.setBurnFee(token0.address, token1.address, fee, overrides)).to.be.revertedWith('TP01')
  })

  it('burn uses newly set burn fee', async () => {
    const { factory, pair, token0, token1, addLiquidity, MINIMUM_LIQUIDITY, PRECISION, wallet } = await loadFixture(
      pairFixture
    )
    const token0Amount = expandTo18Decimals(3)
    const token1Amount = expandTo18Decimals(3)
    await addLiquidity(token0Amount, token1Amount)

    const newBurnFee = 2

    await expect(factory.setBurnFee(token0.address, token1.address, newBurnFee, overrides))
      .to.emit(pair, 'SetBurnFee')
      .withArgs(newBurnFee)
    expect(await pair.burnFee()).to.eq(newBurnFee)

    const walletLiquidity = await pair.balanceOf(wallet.address)
    const factoryLiquidity = await pair.balanceOf(factory.address)
    const feeLiquidity = walletLiquidity.mul(newBurnFee).div(PRECISION)
    const effectiveWalletLiquidity = walletLiquidity.sub(feeLiquidity)

    const expectedToken0Out = effectiveWalletLiquidity.mul(token0Amount).div(expandTo18Decimals(3))
    const expectedToken1Out = effectiveWalletLiquidity.mul(token1Amount).div(expandTo18Decimals(3))

    await pair.transfer(pair.address, walletLiquidity, overrides)

    await pair.burn(wallet.address, overrides)

    expect(await pair.balanceOf(wallet.address)).to.eq(0)
    expect(await pair.balanceOf(factory.address)).to.eq(factoryLiquidity.add(feeLiquidity))
    expect(await pair.totalSupply()).to.eq(factoryLiquidity.add(MINIMUM_LIQUIDITY).add(feeLiquidity))
    expect(await token0.balanceOf(pair.address)).to.eq(token0Amount.sub(expectedToken0Out))
    expect(await token1.balanceOf(pair.address)).to.eq(token1Amount.sub(expectedToken1Out))
  })
})
