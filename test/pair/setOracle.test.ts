import { expect } from 'chai'
import { pairFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { constants } from 'ethers'
import { overrides } from '../shared/utilities'

describe('TwapPair.setOracle', () => {
  const loadFixture = setupFixtureLoader()

  it('can only be called by the factory', async () => {
    const { pair, other } = await loadFixture(pairFixture)
    await expect(pair.setSwapFee(other.address, overrides)).to.be.revertedWith('TP00')
  })

  it('cannot be set to same value', async () => {
    const { pair, factory, token0, token1 } = await loadFixture(pairFixture)
    const oracle = await pair.oracle()
    await expect(factory.setOracle(token0.address, token1.address, oracle, overrides)).to.be.revertedWith('TP01')
  })

  it('reverts if oracle is zero', async () => {
    const { factory, token0, token1 } = await loadFixture(pairFixture)
    await expect(factory.setOracle(token0.address, token1.address, constants.AddressZero, overrides)).to.revertedWith(
      'TP02'
    )
  })

  it('reverts if oracle is not a contract', async () => {
    const { factory, token0, token1, other } = await loadFixture(pairFixture)
    await expect(factory.setOracle(token0.address, token1.address, other.address, overrides)).to.revertedWith('TP1D')
  })
})
