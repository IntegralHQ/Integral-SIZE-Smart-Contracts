import { expect } from 'chai'
import { constants, BigNumber } from 'ethers'
import { formatUnits } from 'ethers/lib/utils'
import { oracleFixture, oracleWithUniswapFixture } from '../shared/fixtures'
import { getTradeFixtureFor } from '../shared/fixtures/getTradeFixtureFor'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, increaseTime, overrides } from '../shared/utilities'

const ONE = BigNumber.from(10).pow(18)

describe('TwapOracle.tradeY', () => {
  const loadFixture = setupFixtureLoader()

  it('traded amount greater than balance', async () => {
    const { oracle } = await loadFixture(oracleFixture)
    await expect(
      oracle.tradeY(expandTo18Decimals(1), 0, 0, await oracle.testEncodeGivenPrice(expandTo18Decimals(1)))
    ).to.be.revertedWith('TO28')
  })

  it('input overflows int256', async () => {
    const { oracle } = await loadFixture(oracleFixture)

    await expect(oracle.tradeY(constants.MaxUint256, 0, 0, [])).to.be.revertedWith('SM34')
    await expect(oracle.tradeY(0, constants.MaxUint256, 0, [])).to.be.revertedWith('SM34')
    await expect(oracle.tradeY(0, 0, constants.MaxUint256, [])).to.be.revertedWith('SM34')
  })

  describe('returns correct values', () => {
    const decimals = [6, 18, 20]

    for (const xDecimals of decimals) {
      for (const yDecimals of decimals) {
        it(`tokenX ${xDecimals} decimals, tokenY ${yDecimals} decimals (price > 0)`, async () => {
          const { tradeY, toDecimals } = await loadFixture(getTradeFixtureFor(xDecimals, yDecimals, '379.55'))
          expect(await tradeY(100, 2137, 100)).to.eq(toDecimals('2137', xDecimals))
          expect(await tradeY(99, 2000, 100)).to.eq(toDecimals('2000.00263469898564089052', xDecimals))
          expect(await tradeY(101, 2000, 100)).to.eq(toDecimals('1999.99736530101435910947', xDecimals))
          expect(await tradeY(50, 1000000, 100)).to.eq(toDecimals('1000000.13173494928204452641', xDecimals))
          expect(await tradeY(150, 1000000, 100)).to.eq(toDecimals('999999.86826505071795547358', xDecimals))
          expect(await tradeY('1000000000000', '1000000000000000000', '2000000000000')).to.eq(
            toDecimals('1000000002634698985.64089052825714662099', xDecimals)
          )
        })

        it(`tokenX ${xDecimals} decimals, tokenY ${yDecimals} decimals (price < 0)`, async () => {
          const { tradeY, toDecimals } = await loadFixture(getTradeFixtureFor(xDecimals, yDecimals, '0.0741'))
          expect(await tradeY(100, 2137, 100)).to.eq(toDecimals('2137', xDecimals))
          expect(await tradeY(99, 2000, 100)).to.eq(toDecimals('2013.49527665317139001349', xDecimals))
          expect(await tradeY(101, 2000, 100)).to.eq(toDecimals('1986.50472334682860998650', xDecimals))
          expect(await tradeY(50, 1000000, 100)).to.eq(toDecimals('1000674.76383265856950067476', xDecimals))
          expect(await tradeY(150, 1000000, 100)).to.eq(toDecimals('999325.23616734143049932523', xDecimals))
          expect(await tradeY('1000000000000', '1000000000000000000', '2000000000000')).to.eq(
            toDecimals('1000013495276653171.39001349527665317139', xDecimals)
          )
        })
      }
    }
  })

  describe('realistic cases', () => {
    it('100 ETH for USDC', async () => {
      const { tradeY, toDecimals } = await loadFixture(getTradeFixtureFor(6, 18, '0.00026'))
      expect(await tradeY('16003', '90550000', '16130')).to.eq(toDecimals('91038461.538461', 6))
    })

    it('100 WBTC for ETH', async () => {
      const { tradeY, toDecimals } = await loadFixture(getTradeFixtureFor(18, 8, '0.0603'))
      expect(await tradeY('1630', '57780', '1730')).to.eq(toDecimals('59438.374792703150912106', 18))
    })

    it('100000 LINK for ETH', async () => {
      const { tradeY, toDecimals } = await loadFixture(getTradeFixtureFor(18, 18, '148.0713'))
      expect(await tradeY('1000000', '2270', '10100000')).to.eq(toDecimals('63726.879219673224993634', 18))
    })

    it('1000000 USDT for USDC', async () => {
      const { tradeY, toDecimals } = await loadFixture(getTradeFixtureFor(6, 6, '1.003'))
      expect(await tradeY('84050000', '43790000', '85050000')).to.eq(toDecimals('44787008.973080', 6))
    })
  })

  it('tradeY after tradeX returns to initial state', async () => {
    const { tradeX, tradeY, toDecimals } = await loadFixture(getTradeFixtureFor(18, 18, '21.3456'))
    const yAfter = await tradeX(2000, 1000, 100000)
    expect(await tradeY(100000, 2000, formatUnits(yAfter))).to.eq(toDecimals('1000', 18))
  })

  it('after uniswap price changes', async () => {
    const { wallet, oracle, addLiquidity, pair, token0 } = await loadFixture(oracleWithUniswapFixture)
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(200))
    const expectedPriceBeforeSwap = 200 / 100

    await oracle.setUniswapPair(pair.address, overrides)
    const { priceAccumulator, priceTimestamp } = await oracle.getPriceInfo()
    await increaseTime(wallet, 10000000) // big time span to position swap in the middle between addLiquidity and trade

    await token0.transfer(pair.address, expandTo18Decimals(101), overrides)
    await pair.swap(0, expandTo18Decimals(100), wallet.address, [], overrides)
    const expectedPriceAfterSwap = 100 / 201

    await increaseTime(wallet, 10000000)
    const { priceInfo } = await oracle.testEncodePriceInfo(priceAccumulator, priceTimestamp, overrides)

    const amount1In = expandTo18Decimals(1)
    const balance0Before = expandTo18Decimals(10)
    const balance1Before = expandTo18Decimals(10)

    const balance0After = await oracle.tradeY(
      balance1Before.add(amount1In),
      balance0Before,
      balance1Before,
      priceInfo,
      overrides
    )
    const amount0Out = balance0Before.sub(balance0After)

    const expectedAmount = amount1In
      .mul(ONE)
      .mul(2)
      .div(expandTo18Decimals(expectedPriceBeforeSwap + expectedPriceAfterSwap))
    // result is not exact as swap is not always exactly in the middle on timeline
    expect(amount0Out).to.be.gte(expectedAmount.mul(9999).div(10000))
    expect(amount0Out).to.be.lte(expectedAmount.mul(10001).div(10000))
  })
})
