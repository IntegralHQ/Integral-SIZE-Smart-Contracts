import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { parseUnits } from 'ethers/lib/utils'
import { pairFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, increaseTime } from '../shared/utilities'

describe('TwapPair.getDepositAmount1In', () => {
  const loadFixture = setupFixtureLoader()

  it('returns 0 when reserves are 0', async () => {
    const { pair, setupUniswapPair } = await loadFixture(pairFixture)
    const { priceInfo } = await setupUniswapPair(1)
    expect(await pair.getDepositAmount1In(expandTo18Decimals(1), priceInfo)).to.deep.eq(BigNumber.from(0))
  })

  it('returns amount1In for price = 1', async () => {
    const { pair, addLiquidity, setupUniswapPair, wallet } = await loadFixture(pairFixture)
    const { priceInfo } = await setupUniswapPair(1)
    await increaseTime(wallet)
    await addLiquidity(expandTo18Decimals(2), expandTo18Decimals(1))
    expect(await pair.getDepositAmount1In(expandTo18Decimals(3), priceInfo)).to.deep.eq(expandTo18Decimals(1))
  })

  it('returns amount1In for price < 1', async () => {
    const { pair, setupUniswapPair, addLiquidity } = await loadFixture(pairFixture)
    const { priceInfo } = await setupUniswapPair(0.25)
    await addLiquidity(expandTo18Decimals(2), expandTo18Decimals(1))
    expect(await pair.getDepositAmount1In(expandTo18Decimals(3), priceInfo)).to.deep.eq(
      parseUnits('0.333333333333333333')
    )
  })

  it('returns amount1In for price > 1', async () => {
    const { pair, setupUniswapPair, addLiquidity } = await loadFixture(pairFixture)
    const { priceInfo } = await setupUniswapPair(1.25)
    await addLiquidity(expandTo18Decimals(4), expandTo18Decimals(1))
    expect(await pair.getDepositAmount1In(expandTo18Decimals(3), priceInfo)).to.deep.eq(
      parseUnits('1.666666666666666666')
    )
  })
})
