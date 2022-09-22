import { expect } from 'chai'
import { setupFixtureLoader } from '../shared/setup'
import { pairFixture, pairWithAdjustableTokensFixture } from '../shared/fixtures'
import { expandTo18Decimals, overrides } from '../shared/utilities'
import { reservesTestFixture } from '../shared/fixtures/reservesTestFixture'

describe('TwapPair.sync', () => {
  const loadFixture = setupFixtureLoader()

  it('correctly updates reserves', async () => {
    const { pair, token0, token1, getState } = await loadFixture(pairWithAdjustableTokensFixture)

    const state0 = await getState()
    expect(state0.reserves[0]).to.eq(0)
    expect(state0.reserves[1]).to.eq(0)

    await token0.setBalance(pair.address, 1234, overrides)
    await token1.setBalance(pair.address, 5678, overrides)
    await pair.sync(overrides)

    const state1 = await getState()
    expect(state1.reserves[0]).to.eq(1234)
    expect(state1.reserves[1]).to.eq(5678)

    await token0.setBalance(pair.address, 5678, overrides)
    await token1.setBalance(pair.address, 1234, overrides)
    await pair.sync(overrides)

    const state2 = await getState()
    expect(state2.reserves[0]).to.eq(5678)
    expect(state2.reserves[1]).to.eq(1234)
  })

  it('can only be called by the trader', async () => {
    const { pair, factory, token0, token1, other, another } = await loadFixture(pairFixture)

    await factory.setTrader(token0.address, token1.address, other.address, overrides)
    await expect(pair.connect(another).sync(overrides)).to.be.revertedWith('TP0C')
    await pair.connect(other).sync()
  })

  it('transfers excess LP tokens to factory', async () => {
    const { pair, factory, addLiquidity } = await loadFixture(pairFixture)

    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await pair.transfer(pair.address, expandTo18Decimals(10), overrides)
    await pair.sync(overrides)

    const balance = await pair.balanceOf(factory.address)
    expect(balance.gt(expandTo18Decimals(10))).to.be.true
    expect(await pair.balanceOf(pair.address)).to.eq(0)
  })

  describe('changes fees proportionally to new balances', async () => {
    it('fees changes proportionally', async () => {
      const { token0, token1, reservesTest, getState } = await loadFixture(reservesTestFixture)

      const state0 = await getState()
      expect(state0.fees[0]).to.eq(0)
      expect(state0.fees[1]).to.eq(0)
      await token0.setBalance(reservesTest.address, 1000, overrides)
      await token1.setBalance(reservesTest.address, 2000, overrides)
      await reservesTest.testAddFees(100, 200, overrides)
      await reservesTest.testSetReserves(overrides)
      await reservesTest.testSyncReserves(overrides)

      const state1 = await getState()
      expect(state1.fees[0]).to.eq(100)
      expect(state1.fees[1]).to.eq(200)
      expect(state1.reserves[0]).to.eq(900)
      expect(state1.reserves[1]).to.eq(1800)
    })

    it('decrease balance', async () => {
      const { token0, token1, reservesTest, getState } = await loadFixture(reservesTestFixture)
      await token0.setBalance(reservesTest.address, 1000, overrides)
      await token1.setBalance(reservesTest.address, 2000, overrides)
      await reservesTest.testAddFees(100, 200, overrides)
      await reservesTest.testSetReserves(overrides)
      await reservesTest.testSyncReserves(overrides)

      await token0.setBalance(reservesTest.address, 100, overrides)
      await token1.setBalance(reservesTest.address, 200, overrides)
      await reservesTest.testSyncReserves(overrides)

      const state = await getState()
      expect(state.fees[0]).to.eq(10)
      expect(state.fees[1]).to.eq(20)
      expect(state.reserves[0]).to.eq(90)
      expect(state.reserves[1]).to.eq(180)
    })

    it('fees will change if balance increase', async () => {
      const { token0, token1, reservesTest, getState } = await loadFixture(reservesTestFixture)

      await token0.setBalance(reservesTest.address, 100, overrides)
      await token1.setBalance(reservesTest.address, 200, overrides)
      await reservesTest.testAddFees(10, 20, overrides)
      await reservesTest.testSetReserves(overrides)
      await reservesTest.testSyncReserves(overrides)

      await token0.setBalance(reservesTest.address, 1000, overrides)
      await token1.setBalance(reservesTest.address, 2000, overrides)
      await reservesTest.testSyncReserves(overrides)

      const state = await getState()
      expect(state.fees[0]).to.eq(100)
      expect(state.fees[1]).to.eq(200)
      expect(state.reserves[0]).to.eq(900)
      expect(state.reserves[1]).to.eq(1800)
    })
  })
})
