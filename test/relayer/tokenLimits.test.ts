import { expect } from 'chai'
import { setupFixtureLoader } from '../shared/setup'
import { getDefaultRelayerBuy, getDefaultRelayerSell, relayerFixture } from '../shared/fixtures'
import { expandTo18Decimals, expandToDecimals, overrides } from '../shared/utilities'
import { OrderType } from '../shared/OrderType'
import { Inversion } from '../shared/InversionType'
import { RelayerFixture } from '../shared/relayerFixtureType'
import { BigNumber, constants, utils, Wallet } from 'ethers'
import { ERC20, TwapRelayerTest, WETH9 } from '../../build/types'

describe('TwapRelayer.tokenLimits', () => {
  const loadFixture = setupFixtureLoader()
  let Env: RelayerFixture

  it('is set to zero on deploy', async () => {
    const { relayer, wethPair } = await loadFixture(relayerFixture)
    expect(await relayer.tokenLimitMin(wethPair.address)).to.eq(0)
    expect(await relayer.tokenLimitMaxMultiplier(wethPair.address)).to.eq(0)
  })

  it('can be changed', async () => {
    const { relayer, other, token } = await loadFixture(relayerFixture)
    await expect(relayer.connect(other).setTokenLimitMin(token.address, 1, overrides)).to.be.revertedWith('TR00')
    await expect(relayer.connect(other).setTokenLimitMaxMultiplier(token.address, 1, overrides)).to.be.revertedWith(
      'TR00'
    )

    await expect(relayer.setTokenLimitMin(token.address, 1, overrides))
      .to.emit(relayer, 'TokenLimitMinSet')
      .withArgs(token.address, 1)
    expect(await relayer.tokenLimitMin(token.address)).to.eq(1)

    await expect(relayer.setTokenLimitMaxMultiplier(token.address, 1, overrides))
      .to.emit(relayer, 'TokenLimitMaxMultiplierSet')
      .withArgs(token.address, 1)
    expect(await relayer.tokenLimitMaxMultiplier(token.address)).to.eq(1)
  })

  it('cannot be set to same value', async () => {
    const { relayer, token } = await loadFixture(relayerFixture)
    await expect(relayer.setTokenLimitMin(token.address, 0, overrides)).to.be.revertedWith('TR01')
    await expect(relayer.setTokenLimitMaxMultiplier(token.address, 0, overrides)).to.be.revertedWith('TR01')
  })

  it('limit max multiplier cannot be set larger than 1', async () => {
    const { relayer, token, PRECISION } = await loadFixture(relayerFixture)
    await expect(relayer.setTokenLimitMaxMultiplier(token.address, PRECISION.add(1), overrides)).to.be.revertedWith(
      'TR3A'
    )
  })

  describe('test trade side and token inversion combinations', () => {
    const gasPrice = utils.parseUnits('69.420', 'gwei')
    const swapAmount = 0.1
    let token0: ERC20 | WETH9
    let token1: ERC20 | WETH9
    let pairPrice: BigNumber
    let invertedPairPrice: BigNumber

    beforeEach(async () => {
      Env = await loadFixture(relayerFixture)
      const { delay, relayer, configureForSwapping, wethPair, token, weth } = Env
      token0 = token.address.toLowerCase() < weth.address.toLowerCase() ? token : weth
      token1 = token0.address === token.address ? weth : token

      await configureForSwapping(false, false, false, false, true)
      await delay.setGasPrice(gasPrice, overrides)

      pairPrice = (await relayer.getPriceByPairAddress(wethPair.address, false, overrides)).price
      invertedPairPrice = (await relayer.getPriceByPairAddress(wethPair.address, true, overrides)).price

      await relayer.setTokenLimitMaxMultiplier(token.address, expandTo18Decimals(1), overrides)
      await relayer.setTokenLimitMaxMultiplier(weth.address, expandTo18Decimals(1), overrides)
    })

    for (const side of [OrderType.Sell, OrderType.Buy]) {
      for (const direction of [Inversion.Direct, Inversion.Inverted]) {
        describe(`${OrderType[side]} - ${Inversion[direction]}`, () => {
          let tokenIn: WETH9 | ERC20
          let tokenOut: WETH9 | ERC20
          let amountBN: BigNumber
          let result: BigNumber
          beforeEach(async () => {
            tokenIn = direction == Inversion.Inverted ? token1 : token0
            tokenOut = direction == Inversion.Inverted ? token0 : token1

            const amountDecimals = side == OrderType.Sell ? await tokenIn.decimals() : await tokenOut.decimals()
            amountBN =
              side == OrderType.Buy
                ? expandToDecimals(swapAmount, amountDecimals)
                : expandToDecimals(swapAmount, amountDecimals)
                    .mul(Env.PRECISION)
                    .div(direction == Inversion.Inverted ? invertedPairPrice : pairPrice)

            result =
              side == OrderType.Buy
                ? await Env.relayer.quoteBuy(tokenIn.address, tokenOut.address, amountBN)
                : await Env.relayer.quoteSell(tokenIn.address, tokenOut.address, amountBN)
          })

          it(`reverts on amountOut < tokenLimitsMin`, async () => {
            await Env.relayer.setTokenLimitMin(
              tokenOut.address,
              side == OrderType.Buy ? amountBN.add(1) : result.add(1)
            )
            await testQuoteAndSwap(Env.relayer, tokenIn, tokenOut, Env.wallet, side, amountBN, result, 'TR03')

            await Env.relayer.setTokenLimitMin(tokenOut.address, side == OrderType.Buy ? amountBN : result)
            await testQuoteAndSwap(Env.relayer, tokenIn, tokenOut, Env.wallet, side, amountBN, result)
          })

          it(`reverts on amountOut > tokenLimitsMax`, async () => {
            const balance = await tokenOut.balanceOf(Env.relayer.address, overrides)
            const transferAmount = side == OrderType.Buy ? balance.sub(amountBN.sub(1)) : balance.sub(result.sub(1))

            await Env.relayer.approve(tokenOut.address, constants.MaxUint256, Env.wallet.address, overrides)
            await tokenOut.approve(Env.wallet.address, constants.MaxUint256, overrides)

            await tokenOut.transferFrom(Env.relayer.address, Env.wallet.address, transferAmount, overrides)
            await testQuoteAndSwap(Env.relayer, tokenIn, tokenOut, Env.wallet, side, amountBN, result, 'TR3A')

            await tokenOut.transferFrom(Env.wallet.address, Env.relayer.address, 1, overrides)
            await testQuoteAndSwap(Env.relayer, tokenIn, tokenOut, Env.wallet, side, amountBN, result)
          })
        })
      }
    }

    async function testQuoteAndSwap(
      relayer: TwapRelayerTest,
      tokenIn: WETH9 | ERC20,
      tokenOut: WETH9 | ERC20,
      wallet: Wallet,
      side: OrderType,
      amount: BigNumber,
      result: BigNumber,
      revertMessage?: string
    ) {
      const getQuotationTx =
        side == OrderType.Sell
          ? relayer.quoteSell(tokenIn.address, tokenOut.address, amount)
          : relayer.quoteBuy(tokenIn.address, tokenOut.address, amount)
      let swapTx
      if (side == OrderType.Sell) {
        const request = getDefaultRelayerSell(tokenIn, tokenOut, wallet)
        request.amountIn = amount
        swapTx = relayer.sell(request, overrides)
      } else {
        const request = getDefaultRelayerBuy(tokenIn, tokenOut, wallet)
        request.amountInMax = result
        request.amountOut = amount
        swapTx = relayer.buy(request, overrides)
      }
      if (revertMessage) {
        await checkTxReverts([getQuotationTx, swapTx], revertMessage)
      } else {
        await checkTxNotReverts([getQuotationTx, swapTx])
      }
    }
    async function checkTxReverts(transactions: Promise<any>[], revertMessage: string) {
      await Promise.all(transactions.map(async (tx) => await expect(tx).to.revertedWith(revertMessage)))
    }
    async function checkTxNotReverts(transactions: Promise<any>[]) {
      await Promise.all(transactions.map(async (tx) => await expect(tx).to.not.be.reverted))
    }
  })
})
