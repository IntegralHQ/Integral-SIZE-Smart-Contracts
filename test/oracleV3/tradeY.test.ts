import { expect } from 'chai'
import { constants, BigNumber } from 'ethers'
import { formatUnits } from 'ethers/lib/utils'
import { oracleFixture, oracleV3WithUniswapFixture } from '../shared/fixtures'
import { getTradeV3FixtureFor } from '../shared/fixtures/getTradeV3FixtureFor'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, increaseTime, increaseTimeWithWorkaround, overrides } from '../shared/utilities'
import { FeeAmount } from '../shared/uniswapV3Utilities'

const ONE = BigNumber.from(10).pow(18)

describe('TwapOracleV3.tradeY', () => {
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
    const values1 = {
      '6': {
        '6': ['2137000000', '2000002635', '1999997366', '1000000131735', '999999868266', '1000000002634698985640891'],
        '18': ['2137000000', '2000002635', '1999997366', '1000000131735', '999999868266', '1000000002634698985640891'],
        '20': ['2137000000', '2000002635', '1999997366', '1000000131735', '999999868266', '1000000002634698985640891'],
      },
      '18': {
        '6': [
          '2137000000000000000000',
          '2000002634698985640891',
          '1999997365301014359110',
          '1000000131734949282044527',
          '999999868265050717955474',
          '1000000002634698985640890528257146621',
        ],
        '18': [
          '2137000000000000000000',
          '2000002634698985640891',
          '1999997365301014359110',
          '1000000131734949282044527',
          '999999868265050717955474',
          '1000000002634698985640890528257146621',
        ],
        '20': [
          '2137000000000000000000',
          '2000002634698985640891',
          '1999997365301014359110',
          '1000000131734949282044527',
          '999999868265050717955474',
          '1000000002634698985640890528257146621',
        ],
      },
      '20': {
        '6': [
          '213700000000000000000000',
          '200000263469898564089053',
          '199999736530101435910948',
          '100000013173494928204452642',
          '99999986826505071795547359',
          '100000000263469898564089052825714662100',
        ],
        '18': [
          '213700000000000000000000',
          '200000263469898564089053',
          '199999736530101435910948',
          '100000013173494928204452642',
          '99999986826505071795547359',
          '100000000263469898564089052825714662100',
        ],
        '20': [
          '213700000000000000000000',
          '200000263469898564089053',
          '199999736530101435910948',
          '100000013173494928204452642',
          '99999986826505071795547359',
          '100000000263469898564089052825714662100',
        ],
      },
    }

    const values2 = {
      '6': {
        '6': ['2137000000', '2013495277', '1986504724', '1000674763833', '999325236168', '1000013495276653171390014'],
        '18': ['2137000000', '2013495277', '1986504724', '1000674763833', '999325236168', '1000013495276653171390014'],
        '20': ['2137000000', '2013495277', '1986504724', '1000674763833', '999325236168', '1000013495276653171390014'],
      },
      '18': {
        '6': [
          '2137000000000000000000',
          '2013495276653171390014',
          '1986504723346828609987',
          '1000674763832658569500675',
          '999325236167341430499326',
          '1000013495276653171390013495276653172',
        ],
        '18': [
          '2137000000000000000000',
          '2013495276653171390014',
          '1986504723346828609987',
          '1000674763832658569500675',
          '999325236167341430499326',
          '1000013495276653171390013495276653172',
        ],
        '20': [
          '2137000000000000000000',
          '2013495276653171390014',
          '1986504723346828609987',
          '1000674763832658569500675',
          '999325236167341430499326',
          '1000013495276653171390013495276653172',
        ],
      },
      '20': {
        '6': [
          '213700000000000000000000',
          '201349527665317139001350',
          '198650472334682860998651',
          '100067476383265856950067477',
          '99932523616734143049932524',
          '100001349527665317139001349527665317140',
        ],
        '18': [
          '213700000000000000000000',
          '201349527665317139001350',
          '198650472334682860998651',
          '100067476383265856950067477',
          '99932523616734143049932524',
          '100001349527665317139001349527665317140',
        ],
        '20': [
          '213700000000000000000000',
          '201349527665317139001350',
          '198650472334682860998651',
          '100067476383265856950067477',
          '99932523616734143049932524',
          '100001349527665317139001349527665317140',
        ],
      },
    }

    for (const xDecimals of decimals) {
      for (const yDecimals of decimals) {
        it(`tokenX ${xDecimals} decimals, tokenY ${yDecimals} decimals (price > 0)`, async () => {
          const { tradeY } = await loadFixture(getTradeV3FixtureFor(xDecimals, yDecimals, '379.55'))
          expect(await tradeY(100, 2137, 100)).to.eq((values1 as any)[xDecimals.toString()][yDecimals.toString()][0])
          expect(await tradeY(99, 2000, 100)).to.eq((values1 as any)[xDecimals.toString()][yDecimals.toString()][1])
          expect(await tradeY(101, 2000, 100)).to.eq((values1 as any)[xDecimals.toString()][yDecimals.toString()][2])
          expect(await tradeY(50, 1000000, 100)).to.eq((values1 as any)[xDecimals.toString()][yDecimals.toString()][3])
          expect(await tradeY(150, 1000000, 100)).to.eq((values1 as any)[xDecimals.toString()][yDecimals.toString()][4])
          expect(await tradeY('1000000000000', '1000000000000000000', '2000000000000')).to.eq(
            (values1 as any)[xDecimals.toString()][yDecimals.toString()][5]
          )
        })

        it(`tokenX ${xDecimals} decimals, tokenY ${yDecimals} decimals (price < 0)`, async () => {
          const { tradeY } = await loadFixture(getTradeV3FixtureFor(xDecimals, yDecimals, '0.0741'))
          expect(await tradeY(100, 2137, 100)).to.eq((values2 as any)[xDecimals.toString()][yDecimals.toString()][0])
          expect(await tradeY(99, 2000, 100)).to.eq((values2 as any)[xDecimals.toString()][yDecimals.toString()][1])
          expect(await tradeY(101, 2000, 100)).to.eq((values2 as any)[xDecimals.toString()][yDecimals.toString()][2])
          expect(await tradeY(50, 1000000, 100)).to.eq((values2 as any)[xDecimals.toString()][yDecimals.toString()][3])
          expect(await tradeY(150, 1000000, 100)).to.eq((values2 as any)[xDecimals.toString()][yDecimals.toString()][4])
          expect(await tradeY('1000000000000', '1000000000000000000', '2000000000000')).to.eq(
            (values2 as any)[xDecimals.toString()][yDecimals.toString()][5]
          )
        })
      }
    }
  })

  describe('realistic cases', () => {
    it('100 ETH for USDC', async () => {
      const { tradeY, toDecimals } = await loadFixture(getTradeV3FixtureFor(6, 18, '0.00026'))
      expect(await tradeY('16003', '90550000', '16130')).to.eq(toDecimals('91038461.538462', 6))
    })

    it('100 WBTC for ETH', async () => {
      const { tradeY, toDecimals } = await loadFixture(getTradeV3FixtureFor(18, 8, '0.0603'))
      expect(await tradeY('1630', '57780', '1730')).to.eq(toDecimals('59438.374792703150912107', 18))
    })

    it('100000 LINK for ETH', async () => {
      const { tradeY, toDecimals } = await loadFixture(getTradeV3FixtureFor(18, 18, '148.0713'))
      expect(await tradeY('1000000', '2270', '10100000')).to.eq(toDecimals('63726.879219673224993635', 18))
    })

    it('1000000 USDT for USDC', async () => {
      const { tradeY, toDecimals } = await loadFixture(getTradeV3FixtureFor(6, 6, '1.003'))
      expect(await tradeY('84050000', '43790000', '85050000')).to.eq(toDecimals('44787008.973081', 6))
    })
  })

  it('tradeY after tradeX returns to initial state', async () => {
    const { tradeX, tradeY, toDecimals } = await loadFixture(getTradeV3FixtureFor(18, 18, '21.3456'))
    const yAfter = await tradeX(2000, 1000, 100000)
    expect(await tradeY(100000, 2000, formatUnits(yAfter))).to.eq(toDecimals('1000', 18))
  })

  it('after uniswap price changes', async () => {
    const { wallet, oracle, addLiquidity, pool, setUniswapPrice, token1, token0, router } = await loadFixture(
      oracleV3WithUniswapFixture
    )
    await setUniswapPrice(expandTo18Decimals(100), expandTo18Decimals(200))
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(200))
    await pool.increaseObservationCardinalityNext(2)
    await oracle.setTwapInterval(2)
    const expectedPriceBeforeSwap = 200 / 100

    await oracle.setUniswapPair(pool.address, overrides)
    await increaseTime(wallet, 1) // big time span to position swap in the middle between addLiquidity and trade

    await router.swapOnUniswap({
      recipient: wallet.address,
      amountIn: expandTo18Decimals(100),
      amountOutMinimum: 0,
      fee: FeeAmount.LOW,
      tokenIn: token0,
      tokenOut: token1,
    })
    const expectedPriceAfterSwap = 100 / 200

    // Tests show that this time increase needs to be done with the workaround.
    await increaseTimeWithWorkaround(wallet, 1)

    const { priceInfo } = await oracle.testEncodePriceInfo(0, 0, overrides)

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

    // geometric mean instead of arithmetic mean in v2
    const expectedAmount = amount1In
      .mul(ONE)
      .div(expandTo18Decimals(Math.sqrt(expectedPriceBeforeSwap * expectedPriceAfterSwap)))

    expect(amount0Out).to.be.gte(expectedAmount.mul(9995).div(10000))
    expect(amount0Out).to.be.lte(expectedAmount)
  })
})
