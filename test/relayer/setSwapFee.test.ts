import { expect } from 'chai'
import { expandTo18Decimals, expandToDecimals, overrides } from '../shared/utilities'
import { getDefaultRelayerBuy, getDefaultRelayerSell, relayerFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { ceil_div } from '../shared/safeMath'

describe('TwapRelayer.setSwapFee', () => {
  const loadFixture = setupFixtureLoader()

  it('can only be called by the owner', async () => {
    const { relayer, pair, other } = await loadFixture(relayerFixture)
    await expect(relayer.connect(other).setSwapFee(pair.address, 1111, overrides)).to.be.revertedWith('TR00')
  })

  it('cannot be set to same value', async () => {
    const { relayer, pair } = await loadFixture(relayerFixture)
    const fee = await relayer.swapFee(pair.address)
    await expect(relayer.setSwapFee(pair.address, fee, overrides)).to.be.revertedWith('TR01')
  })

  it('swap uses newly set swap fee', async () => {
    const { relayer, pair, PRECISION, token0, token1, wallet, configureForSwapping } = await loadFixture(relayerFixture)
    await configureForSwapping()

    const newSwapFee = expandTo18Decimals(0.002)

    await expect(relayer.setSwapFee(pair.address, newSwapFee, overrides))
      .to.emit(relayer, 'SwapFeeSet')
      .withArgs(pair.address, newSwapFee)
    expect(await relayer.swapFee(pair.address)).to.eq(newSwapFee)

    await relayer.setTokenLimitMaxMultiplier(token0.address, expandToDecimals(0.8, await token0.decimals()), overrides)
    await relayer.setTokenLimitMaxMultiplier(token1.address, expandToDecimals(0.8, await token1.decimals()), overrides)
    await relayer.setTokenLimitMin(token0.address, expandToDecimals(0.000001, await token0.decimals()), overrides)
    await relayer.setTokenLimitMin(token1.address, expandToDecimals(0.000001, await token1.decimals()), overrides)
    await token0.transfer(relayer.address, expandTo18Decimals(100), overrides)
    await token1.transfer(relayer.address, expandTo18Decimals(100), overrides)

    const price = (await relayer.getPriceByPairAddress(pair.address, false)).price

    {
      const sellRequest = getDefaultRelayerSell(token0, token1, wallet)

      const feeAmount = sellRequest.amountIn.mul(newSwapFee).div(PRECISION)
      const effectiveAmount0 = sellRequest.amountIn.sub(feeAmount)
      const expectedAmount1 = effectiveAmount0.mul(price).div(sellRequest.amountIn)

      await expect(relayer.sell(sellRequest, overrides))
        .to.emit(relayer, 'Sell')
        .withArgs(
          wallet.address,
          token0.address,
          token1.address,
          sellRequest.amountIn,
          expectedAmount1,
          sellRequest.amountOutMin,
          false,
          feeAmount,
          wallet.address,
          await relayer.delay(),
          1
        )
    }

    {
      const buyRequest = getDefaultRelayerBuy(token0, token1, wallet)

      const expectedAmount0 = ceil_div(buyRequest.amountOut.mul(PRECISION), price)
      const expectedAmount0PlusFee = ceil_div(expectedAmount0.mul(PRECISION), PRECISION.sub(newSwapFee))
      const feeAmount = expectedAmount0PlusFee.sub(expectedAmount0)

      await expect(relayer.buy(buyRequest, overrides))
        .to.emit(relayer, 'Buy')
        .withArgs(
          wallet.address,
          token0.address,
          token1.address,
          expectedAmount0PlusFee,
          buyRequest.amountInMax,
          buyRequest.amountOut,
          false,
          feeAmount,
          wallet.address,
          await relayer.delay(),
          2
        )
    }
  })
})
