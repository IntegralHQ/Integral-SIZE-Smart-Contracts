import { expect } from 'chai'
import { setupFixtureLoader } from '../shared/setup'
import { relayerFixture } from '../shared/fixtures'
import { expandTo18Decimals, expandToDecimals, increaseTime, overrides } from '../shared/utilities'
import { FeeAmount } from '../shared/uniswapV3Utilities'

describe('TwapRelayer.setTwapInterval', () => {
  const loadFixture = setupFixtureLoader()

  it('is set to 0 on deploy', async () => {
    const { relayer, pair } = await loadFixture(relayerFixture)
    expect(await relayer.twapInterval(pair.address)).to.eq(0)
  })

  it('can be changed', async () => {
    const { relayer, other, pair } = await loadFixture(relayerFixture)
    await expect(relayer.connect(other).setTwapInterval(pair.address, 100, overrides)).to.be.revertedWith('TR00')

    await expect(relayer.setTwapInterval(pair.address, 200, overrides))
      .to.emit(relayer, 'TwapIntervalSet')
      .withArgs(pair.address, 200)
    expect(await relayer.twapInterval(pair.address)).to.eq(200)
  })

  it('cannot be set to same value', async () => {
    const { relayer, pair } = await loadFixture(relayerFixture)
    await expect(relayer.setTwapInterval(pair.address, 0, overrides)).to.be.revertedWith('TR01')
  })

  it('cannot be set to zero', async () => {
    const { relayer, pair } = await loadFixture(relayerFixture)
    await relayer.setTwapInterval(pair.address, 1, overrides)
    await expect(relayer.setTwapInterval(pair.address, 0, overrides)).to.be.revertedWith('TR56')
  })

  it('swap uses newly set twap interval', async () => {
    const { relayer, pair, uniswapPool, token0, token1, router, wallet, createObservations } = await loadFixture(
      relayerFixture
    )

    await createObservations()

    await relayer.setTwapInterval(pair.address, 1, overrides)

    const price0 = await relayer.testGetAveragePrice(pair.address, uniswapPool.address, expandTo18Decimals(1))

    await router.swapOnUniswap({
      recipient: wallet.address,
      amountIn: expandToDecimals(10_000, await token0.decimals()),
      amountOutMinimum: 0,
      fee: FeeAmount.LOW,
      tokenIn: token0,
      tokenOut: token1,
    })

    await increaseTime(wallet)

    const price1 = await relayer.testGetAveragePrice(pair.address, uniswapPool.address, expandTo18Decimals(1))

    await relayer.setTwapInterval(pair.address, 10, overrides)

    const price2 = await relayer.testGetAveragePrice(pair.address, uniswapPool.address, expandTo18Decimals(1))

    expect(price0).to.be.gt(price1)
    expect(price1).to.be.lt(price2)
    expect(price0).to.be.gt(price2)
  })
})
