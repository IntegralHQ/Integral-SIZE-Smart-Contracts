import { expect } from 'chai'
import { getOracleWithUniswapFixtureFor } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, expandToDecimals, overrides } from '../shared/utilities'

describe('TwapOracle.getSpotPrice', () => {
  const loadFixture = setupFixtureLoader()

  const decimals = [8, 18, 20]
  const cases = [
    { reserve0: 100, reserve1: 200, expected: 2 },
    { reserve0: 100, reserve1: 100, expected: 1 },
    { reserve0: 400, reserve1: 200, expected: 0.5 },
  ]

  for (const xDecimals of decimals) {
    for (const yDecimals of decimals) {
      for (const { reserve0, reserve1, expected } of cases) {
        it(`Returns correct price for decimals=${xDecimals}/${yDecimals}, reserves=${reserve0}/${reserve1}`, async () => {
          const { oracle, addLiquidity, pair } = await loadFixture(getOracleWithUniswapFixtureFor(xDecimals, yDecimals))
          await addLiquidity(expandToDecimals(reserve0, xDecimals), expandToDecimals(reserve1, yDecimals))
          await oracle.setUniswapPair(pair.address, overrides)
          expect(await oracle.getSpotPrice()).to.eq(expandTo18Decimals(expected))
        })
      }
    }
  }
})
