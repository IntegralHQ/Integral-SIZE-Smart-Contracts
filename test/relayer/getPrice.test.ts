import { expect } from 'chai'
import { BigNumber, utils } from 'ethers'
import { getDefaultRelayerBuy, getDefaultRelayerSell, relayerFixture } from '../shared/fixtures/relayerFixture'
import { Inversion } from '../shared/InversionType'
import { getOrderDigest, getSellOrderData } from '../shared/orders'
import { OrderInternalType, OrderType } from '../shared/OrderType'
import { RelayerFixture } from '../shared/relayerFixtureType'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, expandToDecimals, overrides } from '../shared/utilities'

describe('TwapRelayer.getPrice', () => {
  const loadFixture = setupFixtureLoader()
  let RelayerEnv: RelayerFixture

  describe('checks', () => {
    const gasPrice = utils.parseUnits('69.420', 'gwei')

    beforeEach(async () => {
      RelayerEnv = await loadFixture(relayerFixture)
      const { delay, wethPair, wethPair6decimals, relayer, configureForSwapping } = RelayerEnv
      await configureForSwapping()
      await relayer.setSwapFee(wethPair.address, 1000)
      await relayer.setSwapFee(wethPair6decimals.address, 1000)
      await delay.setGasPrice(gasPrice, overrides)
    })

    it('two overloading functions return same value', async () => {
      const { relayer, pair } = RelayerEnv

      const { price: pricePairArg } = await relayer.getPriceByPairAddress(pair.address, false)
      const { price: invertedPairArg } = await relayer.getPriceByPairAddress(pair.address, true)

      const priceTokenArg = await relayer.getPriceByTokenAddresses(await pair.token0(), await pair.token1())
      const priceTokenArgInverted = await relayer.getPriceByTokenAddresses(await pair.token1(), await pair.token0())

      expect(pricePairArg).to.equal(priceTokenArg)
      expect(invertedPairArg).to.equal(priceTokenArgInverted)
    })

    describe('test trade side and token inversion combinations', () => {
      const testSide = [OrderType.Sell, OrderType.Buy]
      const testInversion = [Inversion.Direct, Inversion.Inverted]

      for (const side of testSide) {
        for (const direction of testInversion) {
          it(`enqueue orders - ${OrderType[side].toString()} - ${Inversion[direction].toString()}`, async () => {
            const { relayer, delay, token6decimals: token, weth, wallet } = RelayerEnv
            const [tokenIn, tokenOut] = direction == Inversion.Inverted ? [token, weth] : [weth, token]

            const amountDecimals = side == OrderType.Sell ? await tokenIn.decimals() : await tokenOut.decimals()
            const amountBN = expandToDecimals(1, amountDecimals)
            let tx
            if (side == OrderType.Sell) {
              const request = getDefaultRelayerSell(tokenIn, tokenOut, wallet)
              request.amountIn = amountBN
              tx = await relayer.sell(request, overrides)
            } else {
              const amountInQuotation = await relayer.quoteBuy(tokenIn.address, tokenOut.address, amountBN)
              const request = getDefaultRelayerBuy(tokenIn, tokenOut, wallet)
              request.amountInMax = amountInQuotation
              request.amountOut = amountBN
              tx = await relayer.buy(request, overrides)
            }
            const receipt = await tx.wait()
            const orderData = getSellOrderData(receipt)
            const { timestamp } = await wallet.provider.getBlock(receipt.blockHash)

            const newestOrderId = await delay.newestOrderId()
            const orderHashOnChain = await delay.getOrderHash(newestOrderId, overrides)
            const orderHash = getOrderDigest(orderData[0])
            expect(orderHash).to.be.eq(orderHashOnChain)
            expect(orderData[0].orderType).to.equal(
              direction == Inversion.Direct ? OrderInternalType.SELL_TYPE : OrderInternalType.SELL_INVERTED_TYPE
            )
            expect(orderData[0].validAfterTimestamp).to.equal((await delay.delay()).add(timestamp))
          })
        }
      }
    })
  })

  describe('quoting function return values matches trading function', async () => {
    const amounts = [1, 0.26, 23.61]
    const amountsBN = amounts.map((amount) => expandTo18Decimals(amount))
    const gasPrice = utils.parseUnits('69.420', 'gwei')
    let prices: BigNumber[], prices6decimals: BigNumber[]

    beforeEach(async () => {
      RelayerEnv = await loadFixture(relayerFixture)
      const { delay, wethPair, wethPair6decimals, relayer, configureForSwapping } = RelayerEnv
      await configureForSwapping()
      await relayer.setSwapFee(wethPair.address, 1000)
      await relayer.setSwapFee(wethPair6decimals.address, 1000)
      await delay.setGasPrice(gasPrice, overrides)
    })

    describe('Sell', async () => {
      beforeEach(async () => {
        const { wethPair, wethPair6decimals, relayer } = RelayerEnv
        prices = []
        prices6decimals = []
        for (let i = 0; i < amountsBN.length; i++) {
          prices.push(await relayer.quoteSell(await wethPair.token0(), await wethPair.token1(), amountsBN[i]))
          prices6decimals.push(
            await relayer.quoteSell(await wethPair6decimals.token0(), await wethPair6decimals.token1(), amountsBN[i])
          )
        }
      })

      for (let i = 0; i < amounts.length; i++) {
        it(`amount ${amounts[i].toString()}`, async () => {
          const { wallet, token, weth, relayer } = RelayerEnv
          const wethBefore = await weth.balanceOf(wallet.address)

          const sellRequest = getDefaultRelayerSell(token, weth, wallet)
          sellRequest.amountIn = expandToDecimals(amounts[i], await token.decimals())
          sellRequest.wrapUnwrap = false

          await relayer.sell(sellRequest, overrides)

          const wethAfter = await weth.balanceOf(wallet.address)
          expect(wethAfter.sub(wethBefore)).to.equal(prices[i])
        })
        it(`different decimals, amount ${amounts[i].toString()}`, async () => {
          const { wallet, token6decimals: token, weth, relayer } = RelayerEnv
          const tokenBefore = await token.balanceOf(wallet.address)

          //TODO: Maybe use token0 and token1 in parameters
          //wethPair and wethPair6decimals have different token positioning
          const sellRequest = getDefaultRelayerSell(weth, token, wallet)
          sellRequest.amountIn = expandToDecimals(amounts[i], await weth.decimals())
          sellRequest.wrapUnwrap = false

          await relayer.sell(sellRequest, overrides)

          const tokenAfter = await token.balanceOf(wallet.address)
          expect(tokenAfter.sub(tokenBefore)).to.equal(prices6decimals[i])
        })
      }
    })

    describe('Buy', async () => {
      beforeEach(async () => {
        const { wethPair, wethPair6decimals, relayer } = RelayerEnv
        prices = []
        prices6decimals = []
        for (let i = 0; i < amountsBN.length; i++) {
          prices.push(await relayer.quoteBuy(await wethPair.token1(), await wethPair.token0(), amountsBN[i]))
          prices6decimals.push(
            await relayer.quoteBuy(await wethPair6decimals.token1(), await wethPair6decimals.token0(), amountsBN[i])
          )
        }
      })

      for (let i = 0; i < amounts.length; i++) {
        it(`amount ${amounts[i].toString()}`, async () => {
          const { wallet, token, weth, relayer } = RelayerEnv
          const wethBefore = await weth.balanceOf(wallet.address)

          const buyRequest = getDefaultRelayerBuy(weth, token, wallet)
          buyRequest.amountOut = expandToDecimals(amounts[i], await token.decimals())
          buyRequest.amountInMax = prices[i]
          buyRequest.wrapUnwrap = false

          await relayer.buy(buyRequest, overrides)

          const wethAfter = await weth.balanceOf(wallet.address)
          expect(wethBefore.sub(wethAfter)).to.equal(prices[i])
        })
        it(`different decimals, amount ${amounts[i].toString()}`, async () => {
          const { wallet, token6decimals: token, weth, relayer } = RelayerEnv
          const tokenBefore = await token.balanceOf(wallet.address)

          const buyRequest = getDefaultRelayerBuy(token, weth, wallet)
          buyRequest.amountOut = expandToDecimals(amounts[i], await weth.decimals())
          buyRequest.amountInMax = prices6decimals[i]
          buyRequest.wrapUnwrap = false

          await relayer.buy(buyRequest, overrides)

          const tokenAfter = await token.balanceOf(wallet.address)
          expect(tokenBefore.sub(tokenAfter)).to.equal(prices6decimals[i])
        })
      }
    })
  })
})
