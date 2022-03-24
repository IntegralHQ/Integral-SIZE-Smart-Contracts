import { expect } from 'chai'
import { setupFixtureLoader } from '../shared/setup'
import { addLiquidityFixture } from '../shared/fixtures'
import { expandTo18Decimals, overrides } from '../shared/utilities'

describe('TwapDelay.addLiquidity', () => {
  const loadFixture = setupFixtureLoader()

  it('returns the amounts when reserves are 0', async () => {
    const { delay, pair } = await loadFixture(addLiquidityFixture)

    const [amount0, amount1] = await delay.addLiquidity(
      pair.address,
      expandTo18Decimals(123),
      expandTo18Decimals(45),
      overrides
    )
    expect(amount0).to.equal(expandTo18Decimals(123))
    expect(amount1).to.equal(expandTo18Decimals(45))
  })

  it('handles amounts that are 0', async () => {
    const { delay, pair, addLiquidity } = await loadFixture(addLiquidityFixture)

    await addLiquidity(expandTo18Decimals(1), expandTo18Decimals(1))
    const [a, b] = await delay.addLiquidity(pair.address, 0, 123, overrides)
    expect(a).to.equal(0)
    expect(b).to.equal(0)
    const [c, d] = await delay.addLiquidity(pair.address, 123, 0, overrides)
    expect(c).to.equal(0)
    expect(d).to.equal(0)
  })

  it('returns values in proportion if amount0Desired is to large', async () => {
    const { delay, pair, addLiquidity } = await loadFixture(addLiquidityFixture)

    await addLiquidity(expandTo18Decimals(1), expandTo18Decimals(2))

    const [amount0, amount1] = await delay.addLiquidity(
      pair.address,
      expandTo18Decimals(110),
      expandTo18Decimals(200),
      overrides
    )
    expect(amount0).to.equal(expandTo18Decimals(100))
    expect(amount1).to.equal(expandTo18Decimals(200))
  })

  it('returns values in proportion if amount1Desired is to large', async () => {
    const { delay, pair, addLiquidity } = await loadFixture(addLiquidityFixture)

    await addLiquidity(expandTo18Decimals(1), expandTo18Decimals(2))

    const [amount0, amount1] = await delay.addLiquidity(
      pair.address,
      expandTo18Decimals(100),
      expandTo18Decimals(210),
      overrides
    )
    expect(amount0).to.equal(expandTo18Decimals(100))
    expect(amount1).to.equal(expandTo18Decimals(200))
  })
})
