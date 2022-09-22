import { expect } from 'chai'
import { oracleV3Fixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { mineBlock } from '../shared/utilities'

describe('TwapOracleV3.getPriceInfo', () => {
  const loadFixture = setupFixtureLoader()

  it('increases in time', async () => {
    const { wallet, provider, oracle } = await loadFixture(oracleV3Fixture)
    const { priceAccumulator: price0, priceTimestamp: priceTimestamp0 } = await oracle.getPriceInfo()
    expect(price0).to.eq(0)
    await provider.send('evm_increaseTime', [1])
    await mineBlock(wallet)
    const { priceAccumulator: price1, priceTimestamp: priceTimestamp1 } = await oracle.getPriceInfo()
    expect(price1).to.eq(0)
    expect(priceTimestamp1).to.gt(priceTimestamp0)
  })
})
