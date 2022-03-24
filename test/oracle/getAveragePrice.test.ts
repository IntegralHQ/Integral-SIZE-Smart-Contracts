import { expect } from 'chai'
import { getOracleWithUniswapFixtureFor } from '../shared/fixtures/getOracleWithUniswapFixtureFor'
import { oracleWithUniswapFixture } from '../shared/fixtures/oracleWithUniswapFixture'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, expandToDecimals, increaseTime, overrides } from '../shared/utilities'

describe('TwapOracle.getAveragePrice', () => {
  const loadFixture = setupFixtureLoader()

  const configurations = [
    [1000, 20, 18, 18],
    [1000, 20, 10, 10],
    [1000, 20, 18, 10],
    [1000, 20, 10, 18],
  ]

  for (const [a, b, xDecimals, yDecimals] of configurations) {
    const fixture = getOracleWithUniswapFixtureFor(xDecimals, yDecimals)
    const permutations = [
      [a, b],
      [b, a],
    ]
    for (const [xSupply, ySupply] of permutations) {
      it(`price for ${xSupply}e${xDecimals}, ${ySupply}e${yDecimals}`, async () => {
        const { pair, addLiquidity, oracle, provider, wallet } = await loadFixture(fixture)

        await addLiquidity(expandToDecimals(xSupply, xDecimals), expandToDecimals(ySupply, yDecimals))
        await provider.send('evm_increaseTime', [1])
        await pair.sync(overrides)

        await oracle.setUniswapPair(pair.address, overrides)

        const { priceAccumulator, priceTimestamp } = await oracle.getPriceInfo()
        await increaseTime(wallet)
        const price = await oracle.getAveragePrice(priceAccumulator, priceTimestamp, overrides)
        const expected = expandTo18Decimals(ySupply / xSupply)
        // This can never be exact, because of the UQ112x112 number format. See this link:
        // https://www.wolframalpha.com/input/?i=floor%2820e18*2%5E112%2F1000e18%29%2F2%5E112
        expect(price).to.be.gt(expected.sub(10))
        expect(price).to.be.lt(expected.add(10))
      })
    }
  }

  it('change after swap', async () => {
    const { pair, addLiquidity, oracle, provider, wallet, token1 } = await loadFixture(oracleWithUniswapFixture)
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(50_000))
    await provider.send('evm_increaseTime', [1])
    await pair.sync(overrides)

    await oracle.setUniswapPair(pair.address, overrides)

    const { priceAccumulator, priceTimestamp } = await oracle.getPriceInfo()
    await increaseTime(wallet)
    const price = await oracle.getAveragePrice(priceAccumulator, priceTimestamp, overrides)

    await increaseTime(wallet)

    await token1.transfer(pair.address, expandTo18Decimals(500))
    await pair.swap(expandTo18Decimals(0.8), 0, wallet.address, [], overrides)

    await increaseTime(wallet)

    const price2 = await oracle.getAveragePrice(priceAccumulator, priceTimestamp, overrides)
    expect(price).to.lt(price2)
  })

  it('reverts when no time elapsed', async () => {
    const { pair, addLiquidity, oracle } = await loadFixture(oracleWithUniswapFixture)
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await oracle.setUniswapPair(pair.address)
    await expect(oracle.testGetAveragePriceForNoTimeElapsed()).to.be.revertedWith('TO20')
  })
})
