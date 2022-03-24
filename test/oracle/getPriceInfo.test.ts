import { expect } from 'chai'
import { oracleWithUniswapFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, mineBlock } from '../shared/utilities'

describe('TwapOracle.getPriceInfo', () => {
  const loadFixture = setupFixtureLoader()

  it('increases in time', async () => {
    const { wallet, provider, oracle, pair, addLiquidity } = await loadFixture(oracleWithUniswapFixture)
    await addLiquidity(expandTo18Decimals(1), expandTo18Decimals(1))
    await oracle.setUniswapPair(pair.address)

    const { priceAccumulator: price0, priceTimestamp: priceTimestamp0 } = await oracle.getPriceInfo()
    await provider.send('evm_increaseTime', [1])
    await mineBlock(wallet)
    const { priceAccumulator: price1, priceTimestamp: priceTimestamp1 } = await oracle.getPriceInfo()
    expect(priceTimestamp1).to.gt(priceTimestamp0)
    expect(price1).to.gt(price0)
  })
})
