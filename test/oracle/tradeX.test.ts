import { expect } from 'chai'
import { constants, BigNumber } from 'ethers'
import { formatUnits } from 'ethers/lib/utils'
import { oracleFixture, oracleWithUniswapFixture } from '../shared/fixtures'
import { getTradeFixtureFor } from '../shared/fixtures/getTradeFixtureFor'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, increaseTime, overrides } from '../shared/utilities'

const ONE = BigNumber.from(10).pow(18)

describe('TwapOracle.tradeX', () => {
  const loadFixture = setupFixtureLoader()

  it('traded amount greater than balance', async () => {
    const { oracle } = await loadFixture(oracleFixture)
    await expect(
      oracle.tradeX(expandTo18Decimals(1), 0, 0, await oracle.testEncodeGivenPrice(expandTo18Decimals(1)))
    ).to.be.revertedWith('TO27')
  })

  it('input overflows int256', async () => {
    const { oracle } = await loadFixture(oracleFixture)

    await expect(oracle.tradeX(constants.MaxUint256, 0, 0, [])).to.be.revertedWith('SM34')
    await expect(oracle.tradeX(0, constants.MaxUint256, 0, [])).to.be.revertedWith('SM34')
    await expect(oracle.tradeX(0, 0, constants.MaxUint256, [])).to.be.revertedWith('SM34')
  })

  describe('returns correct values', () => {
    const decimals = [6, 18, 20]

    for (const xDecimals of decimals) {
      for (const yDecimals of decimals) {
        it(`tokenX ${xDecimals} decimals, tokenY ${yDecimals} decimals (price > 0)`, async () => {
          const { tradeX, toDecimals } = await loadFixture(getTradeFixtureFor(xDecimals, yDecimals, '379.55'))
          expect(await tradeX(100, 100, 2137)).to.eq(toDecimals('2137', yDecimals))
          expect(await tradeX(99, 100, 2000)).to.eq(toDecimals('2379.55', yDecimals))
          expect(await tradeX(101, 100, 2000)).to.eq(toDecimals('1620.45', yDecimals))
          expect(await tradeX(50, 100, 1000000)).to.eq(toDecimals('1018977.5', yDecimals))
          expect(await tradeX(150, 100, 1000000)).to.eq(toDecimals('981022.5', yDecimals))
          expect(await tradeX('1000000000000', '2000000000000', '1000000000000000000')).to.eq(
            toDecimals('1000379550000000000', yDecimals)
          )
        })

        it(`tokenX ${xDecimals} decimals, tokenY ${yDecimals} decimals (price < 0)`, async () => {
          const { tradeX, toDecimals } = await loadFixture(getTradeFixtureFor(xDecimals, yDecimals, '0.0741'))
          expect(await tradeX(100, 100, 2137)).to.eq(toDecimals('2137', yDecimals))
          expect(await tradeX(99, 100, 2000)).to.eq(toDecimals('2000.0741', yDecimals))
          expect(await tradeX(101, 100, 2000)).to.eq(toDecimals('1999.9259', yDecimals))
          expect(await tradeX(50, 100, 1000000)).to.eq(toDecimals('1000003.705', yDecimals))
          expect(await tradeX(150, 100, 1000000)).to.eq(toDecimals('999996.295', yDecimals))
          expect(await tradeX('1000000000000', '2000000000000', '1000000000000000000')).to.eq(
            toDecimals('1000000074100000000', yDecimals)
          )
        })
      }
    }
  })

  describe('correct smallest digits', () => {
    it('6 decimals', async () => {
      const { tradeX, toDecimals } = await loadFixture(getTradeFixtureFor(6, 6, '379.55'))
      expect(await tradeX('101.987654', '99.101231', '2000.657483')).to.eq(toDecimals('905.11563335', 6))
    })

    it('18 decimals', async () => {
      const { tradeX, toDecimals } = await loadFixture(getTradeFixtureFor(18, 18, '379.55'))
      expect(await tradeX('101.987654321098765432', '99.101231012341012345', '2000.657483920115627384')).to.eq(
        toDecimals('905.11551708111044321315', 18)
      )
    })

    it('20 decimals', async () => {
      const { tradeX, toDecimals } = await loadFixture(getTradeFixtureFor(20, 20, '379.55'))
      expect(await tradeX('101.98765432109876543219', '99.10123101234101234511', '2000.65748392011562738495')).to.eq(
        toDecimals('905.115517081110443183736', 20)
      )
    })
  })

  describe('realistic cases', () => {
    it('100 ETH for USDC', async () => {
      const { tradeX, toDecimals } = await loadFixture(getTradeFixtureFor(18, 6, '3850'))
      expect(await tradeX('16003', '16130', '90550000')).to.eq(toDecimals('91038950', 6))
    })

    it('100 WBTC for ETH', async () => {
      const { tradeX, toDecimals } = await loadFixture(getTradeFixtureFor(8, 18, '16.5988'))
      expect(await tradeX('1630', '1730', '57780')).to.eq(toDecimals('59439.88', 18))
    })

    it('100000 LINK for ETH', async () => {
      const { tradeX, toDecimals } = await loadFixture(getTradeFixtureFor(18, 18, '0.00675387'))
      expect(await tradeX('1000000', '10100000', '2270')).to.eq(toDecimals('63730.217', 18))
    })

    it('1000000 USDT for USDC', async () => {
      const { tradeX, toDecimals } = await loadFixture(getTradeFixtureFor(6, 6, '0.9997'))
      expect(await tradeX('84050000', '85050000', '43790000')).to.eq(toDecimals('44789700', 6))
    })
  })

  it('tradeX after tradeY returns to initial state', async () => {
    const { tradeX, tradeY, toDecimals } = await loadFixture(getTradeFixtureFor(18, 18, '21.3456'))
    const xAfter = await tradeY(2000, 100000, 1000)
    expect(await tradeX(100000, formatUnits(xAfter), 2000)).to.eq(toDecimals('999.999999999999999999', 18))
  })

  it('after uniswap price changes', async () => {
    const { wallet, oracle, addLiquidity, pair, token1 } = await loadFixture(oracleWithUniswapFixture)
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(200))
    const expectedPriceBeforeSwap = 200 / 100

    await oracle.setUniswapPair(pair.address, overrides)
    const { priceAccumulator, priceTimestamp } = await oracle.getPriceInfo()
    await increaseTime(wallet, 10000000) // big time span to position swap in the middle between addLiquidity and trade

    await token1.transfer(pair.address, expandTo18Decimals(201), overrides)
    await pair.swap(expandTo18Decimals(50), 0, wallet.address, [], overrides)
    const expectedPriceAfterSwap = 401 / 50
    await increaseTime(wallet, 10000000)

    const { priceInfo } = await oracle.testEncodePriceInfo(priceAccumulator, priceTimestamp)

    const amount0In = expandTo18Decimals(1)
    const balance0Before = expandTo18Decimals(10)
    const balance1Before = expandTo18Decimals(10)

    const balance1After = await oracle.tradeX(
      balance0Before.add(amount0In),
      balance0Before,
      balance1Before,
      priceInfo,
      overrides
    )
    const amount1Out = balance1Before.sub(balance1After)
    const expectedAvgPrice = (expectedPriceBeforeSwap + expectedPriceAfterSwap) / 2

    const expectedAmount = amount0In.mul(expandTo18Decimals(expectedAvgPrice)).div(ONE)
    // result is not exact as swap is not always exactly in the middle on timeline
    expect(amount1Out).to.be.gte(expectedAmount.mul(9999).div(10000))
    expect(amount1Out).to.be.lte(expectedAmount.mul(10001).div(10000))
  })
})
