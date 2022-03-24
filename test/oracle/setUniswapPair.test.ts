import { expect } from 'chai'
import { setupFixtureLoader } from '../shared/setup'
import { oracleWithUniswapFixture } from '../shared/fixtures'
import { expandTo18Decimals, overrides } from '../shared/utilities'
import { constants } from 'ethers'
import { getUniswapPairFixtureFor } from '../shared/fixtures/getUniswapPairFixtureFor'

describe('TwapOracle.setUniswapPair', () => {
  const loadFixture = setupFixtureLoader()

  it('performs security checkings', async () => {
    const { wallet, pair, oracle, other } = await loadFixture(oracleWithUniswapFixture)
    await expect(oracle.connect(other).setUniswapPair(other.address)).to.be.revertedWith('TO00')
    await expect(oracle.setUniswapPair(other.address)).to.be.revertedWith('TO0B')
    await expect(oracle.setUniswapPair(pair.address)).to.be.revertedWith('TO1F')

    {
      const { pair: mixedDecimalsPair } = await getUniswapPairFixtureFor(18, 6)([wallet])
      await expect(oracle.setUniswapPair(mixedDecimalsPair.address)).to.be.revertedWith('TO45')
    }

    {
      const { pair: mixedDecimalsPair } = await getUniswapPairFixtureFor(6, 18)([wallet])
      await expect(oracle.setUniswapPair(mixedDecimalsPair.address)).to.be.revertedWith('TO45')
    }
  })

  it('can be changed', async () => {
    const { pair, addLiquidity, oracle } = await loadFixture(oracleWithUniswapFixture)

    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await expect(oracle.setUniswapPair(pair.address, overrides))
      .to.emit(oracle, 'UniswapPairSet')
      .withArgs(pair.address)
    expect(await oracle.uniswapPair()).to.eq(pair.address)
  })

  it('performs addresses checkings when setting', async () => {
    const { pair, addLiquidity, oracle } = await loadFixture(oracleWithUniswapFixture)
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))

    const uniswapPair = await oracle.uniswapPair()
    await expect(oracle.setUniswapPair(uniswapPair, overrides)).to.be.revertedWith('TO01')

    await oracle.setUniswapPair(pair.address, overrides)
    await expect(oracle.setUniswapPair(constants.AddressZero)).to.be.revertedWith('TO02')
  })
})
