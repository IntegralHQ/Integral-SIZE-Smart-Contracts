import { expect } from 'chai'
import { oracleWithUniswapFixture } from '../shared/fixtures/oracleWithUniswapFixture'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, increaseTime, overrides } from '../shared/utilities'

describe('TwapOracle.decodePriceInfoInfo', () => {
  const loadFixture = setupFixtureLoader()

  it('zero values', async () => {
    const { oracle, setupUniswapPair } = await loadFixture(oracleWithUniswapFixture)

    await setupUniswapPair(1)
    const { price, priceInfo } = await oracle.testEncodePriceInfo(0, 0, overrides)
    const decoded = await oracle.testDecodePriceInfo(priceInfo)
    expect(decoded).to.eq(price)
  })

  it('normal values', async () => {
    const { oracle, pair, addLiquidity, wallet } = await loadFixture(oracleWithUniswapFixture)
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(200))
    await increaseTime(wallet)
    await oracle.setUniswapPair(pair.address, overrides)

    const { priceAccumulator, priceTimestamp } = await oracle.getPriceInfo(overrides)
    await increaseTime(wallet, 3000)
    const { priceInfo, price } = await oracle.testEncodePriceInfo(priceAccumulator, priceTimestamp, overrides)
    const decoded = await oracle.testDecodePriceInfo(priceInfo)
    expect(decoded).to.eq(price)
  })
})
