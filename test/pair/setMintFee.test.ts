import { expect } from 'chai'

import { expandTo18Decimals, overrides } from '../shared/utilities'
import { pairFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'

describe('TwapPair.setMintFee', () => {
  const loadFixture = setupFixtureLoader()

  it('can only be called by the factory', async () => {
    const { pair } = await loadFixture(pairFixture)
    await expect(pair.setMintFee(1111)).to.be.revertedWith('TP00')
  })

  it('cannot be set to same value', async () => {
    const { pair, factory, token0, token1 } = await loadFixture(pairFixture)
    const fee = await pair.mintFee()
    await expect(factory.setMintFee(token0.address, token1.address, fee, overrides)).to.be.revertedWith('TP01')
  })

  it('mint uses newly set mint fee', async () => {
    const { factory, pair, token0, token1, MINIMUM_LIQUIDITY, PRECISION, wallet } = await loadFixture(pairFixture)
    const newMintFee = 2

    await expect(factory.setMintFee(token0.address, token1.address, newMintFee, overrides))
      .to.emit(pair, 'SetMintFee')
      .withArgs(newMintFee)
    expect(await pair.mintFee()).to.eq(newMintFee)

    const token0Amount = expandTo18Decimals(1)
    const token1Amount = expandTo18Decimals(4)
    await token0.transfer(pair.address, token0Amount, overrides)
    await token1.transfer(pair.address, token1Amount, overrides)

    const expectedLiquidity = expandTo18Decimals(2)
    const expectedFee = expectedLiquidity.sub(MINIMUM_LIQUIDITY).mul(newMintFee).div(PRECISION)

    await pair.mint(wallet.address, overrides)

    expect(await pair.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY).sub(expectedFee))
    expect(await token0.balanceOf(pair.address)).to.eq(token0Amount)
    expect(await token1.balanceOf(pair.address)).to.eq(token1Amount)
  })
})
