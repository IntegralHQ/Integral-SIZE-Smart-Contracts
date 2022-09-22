import { expect } from 'chai'
import { constants } from 'ethers'

import { overrides } from '../shared/utilities'
import { pairFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'

describe('TwapPair.setTrader', () => {
  const loadFixture = setupFixtureLoader()

  it('can only be called by the factory', async () => {
    const { pair, other } = await loadFixture(pairFixture)
    await expect(pair.setTrader(other.address, overrides)).to.be.revertedWith('TP00')
  })

  it('cannot be set to same value', async () => {
    const { pair, factory, token0, token1 } = await loadFixture(pairFixture)
    const trader = await pair.trader()
    await expect(factory.setTrader(token0.address, token1.address, trader, overrides)).to.be.revertedWith('TP01')
  })

  it('does not allow anyone to trade when set to 0', async () => {
    const { pair, oracle, other, factory, token0, token1, setupUniswapPair } = await loadFixture(pairFixture)
    await setupUniswapPair(1)
    const { priceInfo } = await oracle.testEncodePriceInfo(0, 0, overrides)

    await factory.setTrader(token0.address, token1.address, constants.AddressZero, overrides)
    await expect(pair.mint(other.address, overrides)).to.be.revertedWith('TP0C')
    await expect(pair.burn(other.address, overrides)).to.be.revertedWith('TP0C')
    await expect(pair.swap(0, 1, other.address, priceInfo, overrides)).to.be.revertedWith('TP0C')
  })

  it('allows a specific address to trade when set to it', async () => {
    const { pair, oracle, wallet, other, factory, token0, token1, setupUniswapPair } = await loadFixture(pairFixture)
    await setupUniswapPair(1)
    const { priceInfo } = await oracle.testEncodePriceInfo(0, 0, overrides)

    await expect(factory.setTrader(token0.address, token1.address, other.address, overrides))
      .to.emit(pair, 'SetTrader')
      .withArgs(other.address)

    await expect(pair.connect(wallet).mint(other.address, overrides)).to.be.revertedWith('TP0C')
    await expect(pair.connect(wallet).burn(other.address, overrides)).to.be.revertedWith('TP0C')
    await expect(pair.connect(wallet).swap(0, 1, other.address, priceInfo, overrides)).to.be.revertedWith('TP0C')

    await expect(pair.connect(other).mint(other.address, overrides)).not.to.be.revertedWith('TP0C')
    await expect(pair.connect(other).burn(other.address, overrides)).not.to.be.revertedWith('TP0C')
    await expect(pair.connect(other).swap(0, 1, other.address, priceInfo, overrides)).not.to.be.revertedWith('TP0C')
  })
})
