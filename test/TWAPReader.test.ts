import { expect } from 'chai'
import { pairFixture } from './shared/fixtures'
import { setupFixtureLoader } from './shared/setup'
import { expandTo18Decimals, overrides } from './shared/utilities'

import { BigNumber } from 'ethers'
import { TwapReader__factory } from '../build/types'

describe('TwapReader', () => {
  const loadFixture = setupFixtureLoader()

  it('returns all important parameters', async () => {
    const { setupUniswapPair, pair, oracle, token0, addLiquidity, wallet } = await loadFixture(pairFixture)

    const reader = await new TwapReader__factory(wallet).deploy(overrides)

    await addLiquidity(expandTo18Decimals(15), expandTo18Decimals(40))
    await setupUniswapPair(15)
    await token0.transfer(pair.address, expandTo18Decimals(10), overrides)
    await pair.sync(overrides)

    const reserves = await pair.getReserves()
    const price = await oracle.getSpotPrice()
    const mintFee = await pair.mintFee()
    const burnFee = await pair.burnFee()
    const swapFee = await pair.swapFee()

    const result = await reader.getPairParameters(pair.address)
    expect(result).to.deep.equal([true, reserves[0], reserves[1], price, mintFee, burnFee, swapFee])
  })

  it('returns false and empty data if pair does not exist', async () => {
    const { wallet, provider } = await loadFixture(pairFixture)

    const reader = await new TwapReader__factory(wallet).deploy(overrides)

    const result = await reader.getPairParameters(provider.createEmptyWallet().address)
    expect(result).to.deep.equal([
      false,
      BigNumber.from(0),
      BigNumber.from(0),
      BigNumber.from(0),
      BigNumber.from(0),
      BigNumber.from(0),
      BigNumber.from(0),
    ])
  })
})
