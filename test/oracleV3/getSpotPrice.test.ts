import { expect } from 'chai'
import { getOracleV3WithUniswapFixtureFor } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, expandToDecimals, overrides } from '../shared/utilities'

describe('TwapOracleV3.getSpotPrice', () => {
  const loadFixture = setupFixtureLoader()

  const decimals = [6, 8, 18, 20]
  const cases = [
    { reserve0: 100, reserve1: 200, expected: 2 },
    { reserve0: 100, reserve1: 100, expected: 1 },
    { reserve0: 400, reserve1: 200, expected: 0.5 },
  ]

  for (const xDecimals of decimals) {
    for (const yDecimals of decimals) {
      for (const { reserve0, reserve1, expected } of cases) {
        it(`Returns correct price for decimals=${xDecimals}/${yDecimals}, reserves=${reserve0}/${reserve1}`, async () => {
          const { oracle, setUniswapPrice, addLiquidity, pool } = await loadFixture(
            getOracleV3WithUniswapFixtureFor(xDecimals, yDecimals)
          )
          await setUniswapPrice(expandToDecimals(reserve0, xDecimals), expandToDecimals(reserve1, yDecimals))
          await addLiquidity(expandToDecimals(reserve0, xDecimals), expandToDecimals(reserve1, yDecimals))
          await oracle.setUniswapPair(pool.address, overrides)
          expect(
            expandTo18Decimals(expected)
              .sub(await oracle.getSpotPrice())
              .toNumber()
          ).to.lte(1)
        })
      }
    }
  }

  it('price overflows uint128', async () => {
    const xDecimals = 18
    const yDecimals = 18
    const { pool, setUniswapPrice, addLiquidity, oracle } = await loadFixture(
      getOracleV3WithUniswapFixtureFor(xDecimals, yDecimals)
    )
    const MaxUint128Price = '18446744073709553000'

    await setUniswapPrice(expandToDecimals(1, xDecimals), expandToDecimals(MaxUint128Price, yDecimals))
    await addLiquidity(expandToDecimals(1, xDecimals), expandToDecimals(1, yDecimals))
    await oracle.setUniswapPair(pool.address, overrides)
    await oracle.setTwapInterval(1, overrides)

    const spotPrice = await oracle.getSpotPrice(overrides)
    expect(expandTo18Decimals(MaxUint128Price).sub(spotPrice).toNumber()).to.lte(1)
  })
})
