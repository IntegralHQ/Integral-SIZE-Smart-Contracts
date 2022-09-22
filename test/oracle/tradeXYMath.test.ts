import { expect } from 'chai'
import { oracleFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals } from '../shared/utilities'

describe('TwapOracle.tradeXY', () => {
  const loadFixture = setupFixtureLoader()
  const price = expandTo18Decimals('21.3456')
  const xBefore = expandTo18Decimals('100000')
  const yBefore = expandTo18Decimals('1000')

  it('test_tradeXY1', async () => {
    const { oracle } = await loadFixture(oracleFixture)

    const priceData = await oracle.testEncodeGivenPrice(price)
    const yAfter = expandTo18Decimals('2000')

    const _yAfter = await oracle.tradeX(
      await oracle.tradeY(yAfter, xBefore, yBefore, priceData),
      xBefore,
      yBefore,
      priceData
    )

    expect(_yAfter.sub(yAfter)).to.be.lte(0)
  })

  it('test_tradeYX1', async () => {
    const { oracle } = await loadFixture(oracleFixture)

    const priceData = await oracle.testEncodeGivenPrice(price)
    const xAfter = expandTo18Decimals('2000')

    const _xAfter = await oracle.tradeY(
      await oracle.tradeX(xAfter, xBefore, yBefore, priceData),
      xBefore,
      yBefore,
      priceData
    )

    expect(_xAfter.sub(xAfter)).to.be.lte(0)
  })

  it('test_tradeXY2', async () => {
    const { oracle } = await loadFixture(oracleFixture)

    const priceData = await oracle.testEncodeGivenPrice(price)
    const yAfter = expandTo18Decimals('300')

    const _yAfter = await oracle.tradeX(
      xBefore,
      await oracle.tradeY(yAfter, xBefore, yBefore, priceData),
      yAfter,
      priceData
    )

    expect(_yAfter.sub(yBefore)).to.be.gte(0)
  })

  it('test_tradeYX2', async () => {
    const { oracle } = await loadFixture(oracleFixture)

    const priceData = await oracle.testEncodeGivenPrice(price)
    const xAfter = expandTo18Decimals('2000').add(1)

    const _xAfter = await oracle.tradeY(
      yBefore,
      xAfter,
      await oracle.tradeX(xAfter, xBefore, yBefore, priceData),
      priceData
    )

    expect(_xAfter.sub(xBefore)).to.be.gte(0)
  })

  it('test_tradeXX', async () => {
    const { oracle } = await loadFixture(oracleFixture)

    const priceData = await oracle.testEncodeGivenPrice(price)
    const xAfter = expandTo18Decimals('2000').add(1)

    const _yAfter = await oracle.tradeX(
      xBefore,
      xAfter,
      await oracle.tradeX(xAfter, xBefore, yBefore, priceData),
      priceData
    )

    expect(_yAfter.sub(yBefore)).to.be.gte(0)
  })

  it('test_tradeYY', async () => {
    const { oracle } = await loadFixture(oracleFixture)

    const priceData = await oracle.testEncodeGivenPrice(price)
    const yAfter = expandTo18Decimals('2000')

    const _xAfter = await oracle.tradeY(
      yBefore,
      await oracle.tradeY(yAfter, xBefore, yBefore, priceData),
      yAfter,
      priceData
    )

    expect(_xAfter.sub(xBefore)).to.be.gte(0)
  })
})
