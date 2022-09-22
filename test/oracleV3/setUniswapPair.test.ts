import { expect } from 'chai'
import { setupFixtureLoader } from '../shared/setup'
import { oracleV3WithUniswapFixture } from '../shared/fixtures'
import { expandTo18Decimals, overrides } from '../shared/utilities'
import { constants } from 'ethers'
import { getUniswapPairFixtureFor } from '../shared/fixtures/getUniswapPairFixtureFor'

describe('TwapOracleV3.setUniswapPair', () => {
  const loadFixture = setupFixtureLoader()

  it('performs security checkings', async () => {
    const { wallet, pool, oracle, other } = await loadFixture(oracleV3WithUniswapFixture)
    await expect(oracle.connect(other).setUniswapPair(other.address, overrides)).to.be.revertedWith('TO00')
    await expect(oracle.setUniswapPair(other.address, overrides)).to.be.revertedWith('TO0B')
    await expect(oracle.setUniswapPair(pool.address, overrides)).to.be.revertedWith('TO1F')

    {
      const { pair: mixedDecimalsPair } = await getUniswapPairFixtureFor(18, 6)([wallet])
      await expect(oracle.setUniswapPair(mixedDecimalsPair.address, overrides)).to.be.revertedWith('TO45')
    }

    {
      const { pair: mixedDecimalsPair } = await getUniswapPairFixtureFor(6, 18)([wallet])
      await expect(oracle.setUniswapPair(mixedDecimalsPair.address, overrides)).to.be.revertedWith('TO45')
    }
  })

  it('can be changed', async () => {
    const { pool, setUniswapPrice, addLiquidity, oracle } = await loadFixture(oracleV3WithUniswapFixture)

    await setUniswapPrice(expandTo18Decimals(100), expandTo18Decimals(100))
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await expect(oracle.setUniswapPair(pool.address, overrides))
      .to.emit(oracle, 'UniswapPairSet')
      .withArgs(pool.address)
    expect(await oracle.uniswapPair()).to.eq(pool.address)
  })

  it('performs addresses checkings when setting', async () => {
    const { pool, setUniswapPrice, addLiquidity, oracle } = await loadFixture(oracleV3WithUniswapFixture)
    await setUniswapPrice(expandTo18Decimals(100), expandTo18Decimals(100))
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))

    const uniswapPair = await oracle.uniswapPair()
    await expect(oracle.setUniswapPair(uniswapPair, overrides)).to.be.revertedWith('TO01')

    await oracle.setUniswapPair(pool.address, overrides)
    await expect(oracle.setUniswapPair(constants.AddressZero, overrides)).to.be.revertedWith('TO02')
  })
})
