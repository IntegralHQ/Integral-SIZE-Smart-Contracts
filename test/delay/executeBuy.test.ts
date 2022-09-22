import { expect } from 'chai'
import { BigNumber, providers } from 'ethers'
import { EtherHater__factory } from '../../build/types'
import { delayFixture } from '../shared/fixtures'
import { delayFailingFixture } from '../shared/fixtures/delayFailingFixture'
import { getDelayWithMixedDecimalsPairFixtureFor } from '../shared/fixtures/delayWithMixedDecimalsPairFixture'
import { buyAndWait } from '../shared/orders'
import { setupFixtureLoader } from '../shared/setup'
import { encodeErrorData } from '../shared/solidityError'
import {
  expandTo18Decimals,
  expandToDecimals,
  getEthRefund,
  getEvents,
  getGasSpent,
  MIN_ALLOWED_GAS_LIMIT,
  overrides,
  pairAddressToPairId,
} from '../shared/utilities'

describe('TwapDelay.executeBuy', () => {
  const loadFixture = setupFixtureLoader()

  describe('execution', () => {
    it('removes the order from the queue', async () => {
      const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayFixture)

      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))
      await buyAndWait(delay, token0, token1, wallet, {
        gasLimit: 450000,
      })
      await delay.execute(1, overrides)

      expect(await delay.lastProcessedOrderId()).to.equal(1)
    })

    it('token0 for token1', async () => {
      const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayFixture)
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

      const balanceBefore = await token1.balanceOf(wallet.address)
      await buyAndWait(delay, token0, token1, wallet, {
        amountInMax: expandTo18Decimals(4),
        amountOut: expandTo18Decimals(1),
      })

      const tx = await delay.execute(1, overrides)
      const balanceAfter = await token1.balanceOf(wallet.address)
      const events = await getEvents(tx, 'OrderExecuted')

      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      expect(balanceAfter.sub(balanceBefore)).to.eq(expandTo18Decimals(1))
    })

    it('token1 for token0', async () => {
      const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayFixture)
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

      const balanceBefore = await token0.balanceOf(wallet.address)
      await buyAndWait(delay, token1, token0, wallet, {
        amountInMax: expandTo18Decimals(4),
        amountOut: expandTo18Decimals(1),
      })
      const tx = await delay.execute(1, overrides)
      const balanceAfter = await token0.balanceOf(wallet.address)
      const events = await getEvents(tx, 'OrderExecuted')

      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      expect(balanceAfter.sub(balanceBefore)).to.eq(expandTo18Decimals(1))
    })

    it('token for weth', async () => {
      const { delay, weth, token, wallet, addLiquidityETH, other } = await loadFixture(delayFixture)
      await addLiquidityETH(expandTo18Decimals(10), expandTo18Decimals(10))

      await buyAndWait(delay, token, weth, wallet, {
        amountInMax: expandTo18Decimals(4),
        amountOut: expandTo18Decimals(1),
        gasLimit: 450000,
        wrapUnwrap: true,
      })
      const balanceBefore = await wallet.getBalance()
      const tx = await delay.connect(other).execute(1, overrides)
      const balanceAfter = await wallet.getBalance()
      const events = await getEvents(tx, 'OrderExecuted')

      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      expect(balanceAfter.sub(balanceBefore)).to.be.gt(expandTo18Decimals(1))
    })

    it('weth for token', async () => {
      const { delay, weth, token, wallet, addLiquidityETH, other } = await loadFixture(delayFixture)
      await addLiquidityETH(expandTo18Decimals(10), expandTo18Decimals(10))

      await buyAndWait(delay, weth, token, wallet, {
        etherAmount: expandTo18Decimals(4),
        amountInMax: expandTo18Decimals(4),
        amountOut: expandTo18Decimals(1),
        gasLimit: 450000,
        wrapUnwrap: true,
      })
      const balanceBefore = await token.balanceOf(wallet.address)
      const tx = await delay.connect(other).execute(1, overrides)
      const balanceAfter = await token.balanceOf(wallet.address)
      const events = await getEvents(tx, 'OrderExecuted')

      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      expect(balanceAfter.sub(balanceBefore)).to.eq(expandTo18Decimals(1))
    })

    it('does not modify the order if tokens are transferred to pair', async () => {
      const { delay, token0, token1, pair, other, addLiquidity } = await loadFixture(delayFixture)
      await addLiquidity(expandTo18Decimals(1000), expandTo18Decimals(1000))

      await token0.transfer(other.address, expandTo18Decimals(100), overrides)

      await buyAndWait(delay, token0, token1, other, {
        amountInMax: expandTo18Decimals(1),
        amountOut: expandTo18Decimals(0.9),
        gasLimit: 450000,
      })
      await token0.transfer(pair.address, expandTo18Decimals(100), overrides)

      const tx = await delay.execute(1, overrides)
      const events = await getEvents(tx, 'OrderExecuted')

      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      const [, reserve1] = await pair.getReserves()
      expect(reserve1.gte(expandTo18Decimals(999))).to.be.true
    })

    it('cannot unwrap WETH', async () => {
      const { delay, weth, token, wallet, other, addLiquidityETH } = await loadFixture(delayFixture)
      await addLiquidityETH(expandTo18Decimals(100), expandTo18Decimals(100))

      const etherHater = await new EtherHater__factory(wallet).deploy(overrides)

      const buyRequest = await buyAndWait(delay, token, weth, etherHater, {
        gasLimit: 520000,
        amountInMax: expandTo18Decimals(5),
        amountOut: expandTo18Decimals(1),
        wrapUnwrap: true,
      })

      const wethBalanceBefore = await weth.balanceOf(etherHater.address)
      const balanceBefore = await wallet.provider.getBalance(etherHater.address)
      const tx = await delay.connect(other).execute(1, overrides)
      const wethBalanceAfter = await weth.balanceOf(etherHater.address)
      const balanceAfter = await wallet.provider.getBalance(etherHater.address)

      const orderExecuted = await getEvents(tx, 'OrderExecuted')
      const [event] = await getEvents(tx, 'UnwrapFailed')
      function getAmount(event: any) {
        return event.args.amount
      }
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(orderExecuted[0]), getEthRefund(orderExecuted[0]))
        .to.emit(delay, 'UnwrapFailed')
        .withArgs(etherHater.address, getAmount(event))

      expect(balanceBefore).to.eq(balanceAfter)
      expect(wethBalanceAfter.sub(wethBalanceBefore)).to.eq(buyRequest.amountOut)
    })
  })

  describe('partial execution', () => {
    it('token0 for token1', async () => {
      const { delay, token0, token1, pair, oracle, wallet, addLiquidity, getEncodedPriceInfo } = await loadFixture(
        delayFixture
      )
      const [reserve0, reserve1] = [expandTo18Decimals(10), expandTo18Decimals(10)]
      await addLiquidity(reserve0, reserve1)

      const [balanceBefore0, balanceBefore1] = [
        await token0.balanceOf(wallet.address),
        await token1.balanceOf(wallet.address),
      ]
      await buyAndWait(delay, token0, token1, wallet, {
        amountInMax: expandTo18Decimals(11),
        amountOut: expandTo18Decimals(11),
      })

      // Transfer doesn't affect trade
      await token0.transfer(delay.address, expandTo18Decimals(5), overrides)

      const reserveOut = reserve1.sub(1)
      const { amountOut } = await oracle.getSwapAmountInMinOut(
        false,
        await pair.swapFee(),
        reserveOut,
        await getEncodedPriceInfo()
      )

      const tx = await delay.execute(1, overrides)
      const [balanceAfter0, balanceAfter1] = [
        await token0.balanceOf(wallet.address),
        await token1.balanceOf(wallet.address),
      ]

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
        .to.emit(pair, 'Swap')
        .withArgs(delay.address, balanceBefore0.sub(balanceAfter0), 0, 0, amountOut, wallet.address)
      expect(balanceAfter1.sub(balanceBefore1)).to.eq(amountOut)
    })

    it('token1 for token0', async () => {
      const { delay, token0, token1, pair, oracle, wallet, addLiquidity, getEncodedPriceInfo } = await loadFixture(
        delayFixture
      )
      const [reserve0, reserve1] = [expandTo18Decimals(10), expandTo18Decimals(10)]
      await addLiquidity(reserve0, reserve1)

      const [balanceBefore0, balanceBefore1] = [
        await token0.balanceOf(wallet.address),
        await token1.balanceOf(wallet.address),
      ]
      await buyAndWait(delay, token1, token0, wallet, {
        amountInMax: expandTo18Decimals(23),
        amountOut: expandTo18Decimals(11),
      })

      // Transfer doesn't affect trade
      await token1.transfer(delay.address, expandTo18Decimals(5), overrides)

      const reserveOut = reserve0.sub(1)
      const { amountOut } = await oracle.getSwapAmountInMinOut(
        true,
        await pair.swapFee(),
        reserveOut,
        await getEncodedPriceInfo()
      )

      const tx = await delay.execute(1, overrides)
      const [balanceAfter0, balanceAfter1] = [
        await token0.balanceOf(wallet.address),
        await token1.balanceOf(wallet.address),
      ]

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
        .to.emit(pair, 'Swap')
        .withArgs(delay.address, 0, balanceBefore1.sub(balanceAfter1), amountOut, 0, wallet.address)
      expect(balanceAfter0.sub(balanceBefore0)).to.eq(amountOut)
    })

    it('token for weth', async () => {
      const { delay, weth, token, wethPair, oracle, wallet, addLiquidityETH, other, getEncodedPriceInfo } =
        await loadFixture(delayFixture)
      const [reserveToken, reserveEth] = [expandTo18Decimals(10), expandTo18Decimals(10)]
      await addLiquidityETH(reserveToken, reserveEth)

      const balanceBeforeToken = await token.balanceOf(wallet.address)
      await buyAndWait(delay, token, weth, wallet, {
        amountInMax: expandTo18Decimals(110),
        amountOut: expandTo18Decimals(200),
        gasLimit: 450000,
        wrapUnwrap: true,
      })

      // Transfer doesn't affect trade
      await token.transfer(delay.address, expandTo18Decimals(200), overrides)

      const balanceBeforeEth = await wallet.getBalance()

      const reserveOut = reserveEth.sub(1)
      const { amountOut } = await oracle.getSwapAmountInMinOut(
        token.address.toLowerCase() > weth.address.toLowerCase(),
        await wethPair.swapFee(),
        reserveOut,
        await getEncodedPriceInfo()
      )

      const tx = await delay.connect(other).execute(1, overrides)
      const [balanceAfterEth, balanceAfterToken] = [await wallet.getBalance(), await token.balanceOf(wallet.address)]

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
        .to.emit(wethPair, 'Swap')
        .withArgs(delay.address, balanceBeforeToken.sub(balanceAfterToken), 0, 0, amountOut, delay.address)
      expect(balanceAfterEth.sub(balanceBeforeEth)).to.be.gt(amountOut)
    })

    it('weth for token', async () => {
      const { delay, weth, token, wethPair, oracle, wallet, addLiquidityETH, other, getEncodedPriceInfo } =
        await loadFixture(delayFixture)
      const [reserveToken, reserveEth] = [expandTo18Decimals(10), expandTo18Decimals(10)]
      await addLiquidityETH(reserveToken, reserveEth)

      const balanceBeforeToken = await token.balanceOf(wallet.address)
      await buyAndWait(delay, weth, token, wallet, {
        etherAmount: expandTo18Decimals(200),
        amountInMax: expandTo18Decimals(200),
        amountOut: expandTo18Decimals(90),
        gasLimit: 450000,
        wrapUnwrap: true,
      })

      // Transfer doesn't affect trade
      const injectedWeth = expandTo18Decimals(100)
      await weth.deposit({
        value: injectedWeth,
        ...overrides,
      })
      await weth.transfer(delay.address, expandTo18Decimals(100), overrides)

      const reserveOut = reserveToken.sub(1)
      const { amountIn, amountOut } = await oracle.getSwapAmountInMinOut(
        weth.address.toLowerCase() > token.address.toLowerCase(),
        await wethPair.swapFee(),
        reserveOut,
        await getEncodedPriceInfo()
      )

      const tx = await delay.connect(other).execute(1, overrides)
      const balanceAfterToken = await token.balanceOf(wallet.address)

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
        .to.emit(wethPair, 'Swap')
        .withArgs(delay.address, 0, amountIn, amountOut, 0, wallet.address)
      expect(balanceAfterToken.sub(balanceBeforeToken)).to.be.eq(amountOut)

      // Don't refund weth
      const balanceAfterWeth = await weth.balanceOf(delay.address)
      expect(balanceAfterWeth).to.be.eq(injectedWeth)
    })
  })

  describe('errors', () => {
    it('insufficient input 0 amount', async () => {
      const { delay, token0, token1, wallet, other, addLiquidity } = await loadFixture(delayFixture)
      await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))

      await buyAndWait(delay, token0, token1, wallet, {
        amountInMax: expandTo18Decimals(1),
        amountOut: expandTo18Decimals(4),
        gasLimit: 450000,
      })
      const tx = await delay.connect(other).execute(1, overrides)
      const events = await getEvents(tx, 'OrderExecuted')

      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TD08'), getGasSpent(events[0]), getEthRefund(events[0]))
    })

    it('insufficient input 1 amount', async () => {
      const { delay, token0, token1, wallet, other, addLiquidity } = await loadFixture(delayFixture)
      await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))

      await buyAndWait(delay, token1, token0, wallet, {
        amountInMax: expandTo18Decimals(1),
        amountOut: expandTo18Decimals(4),
        gasLimit: 450000,
      })
      const tx = await delay.connect(other).execute(1, overrides)
      const events = await getEvents(tx, 'OrderExecuted')

      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TD08'), getGasSpent(events[0]), getEthRefund(events[0]))
    })

    it('hits the 48 hours deadline', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)

      await buyAndWait(delay, token0, token1, wallet, {
        gasLimit: 450000,
      })
      await (delay.provider as providers.JsonRpcProvider).send('evm_increaseTime', [48 * 60 * 60])

      const tx = await delay.execute(1, overrides)
      const events = await getEvents(tx, 'OrderExecuted')

      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TD04'), getGasSpent(events[0]), getEthRefund(events[0]))
    })

    it('out of gas', async () => {
      const { delay, token0, token1, wallet, other, addLiquidity } = await loadFixture(delayFixture)
      await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))

      await buyAndWait(delay, token0, token1, wallet, { gasLimit: MIN_ALLOWED_GAS_LIMIT })

      const tx = await delay.connect(other).execute(1, overrides)
      const events = await getEvents(tx, 'OrderExecuted')

      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      expect(await delay.lastProcessedOrderId()).to.eq(1)
      expect(await delay.newestOrderId()).to.eq(1)
    })

    it('if token refund fails order is still in queue', async () => {
      const { delay, token0, token1, wallet, addLiquidity, pair } = await loadFixture(delayFailingFixture)

      await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
      const buy = await buyAndWait(delay, token0, token1, wallet, {
        gasLimit: 200000,
      })

      await token0.setWasteTransferGas(true)
      const tx = await delay.execute(1, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
        .to.emit(delay, 'RefundFailed')
        .withArgs(buy.to, token0.address, buy.amountInMax, encodeErrorData('TH05'))

      const orderInQueue = await delay.getBuyOrder(1, overrides)
      const order = [
        pairAddressToPairId(pair.address),
        false,
        buy.amountInMax,
        buy.amountOut,
        buy.wrapUnwrap,
        buy.to,
        buy.gasPrice,
        BigNumber.from(buy.gasLimit),
        orderInQueue.validAfterTimestamp,
        orderInQueue.priceAccumulator,
        orderInQueue.timestamp,
      ]
      expect(order).to.deep.eq(orderInQueue)
      expect(await delay.lastProcessedOrderId()).to.eq(1)
      expect(await delay.newestOrderId()).to.eq(1)
    })

    it('if ether refund fails order is still in queue', async () => {
      const { delay, token, weth, wallet, addLiquidityETH, wethPair } = await loadFixture(delayFixture)
      await addLiquidityETH(expandTo18Decimals(100), expandTo18Decimals(100))
      const etherHater = await new EtherHater__factory(wallet).deploy(overrides)

      // The order fails due to insufficient input amount.
      const buy = await buyAndWait(delay, weth, token, wallet, {
        to: etherHater.address,
        etherAmount: expandTo18Decimals(4),
        amountInMax: expandTo18Decimals(1),
        amountOut: expandTo18Decimals(1),
        gasLimit: 450_000,
        wrapUnwrap: true,
      })

      const tx = await delay.execute(1, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TD08'), getGasSpent(events[0]), getEthRefund(events[0]))
        .to.emit(delay, 'RefundFailed')
        .withArgs(buy.to, weth.address, buy.amountInMax, encodeErrorData('TH3F'))

      const orderInQueue = await delay.getBuyOrder(1, overrides)
      const order = [
        pairAddressToPairId(wethPair.address),
        BigNumber.from(weth.address).gt(BigNumber.from(token.address)),
        buy.amountInMax,
        buy.amountOut,
        buy.wrapUnwrap,
        buy.to,
        buy.gasPrice,
        BigNumber.from(buy.gasLimit),
        orderInQueue.validAfterTimestamp,
        orderInQueue.priceAccumulator,
        orderInQueue.timestamp,
      ]
      expect(order).to.deep.eq(orderInQueue)
      expect(await delay.lastProcessedOrderId()).to.eq(1)
      expect(await delay.newestOrderId()).to.eq(1)
    })
  })

  describe('refund', () => {
    it('eth to bot', async () => {
      const { delay, token0, token1, wallet, other, addLiquidity, orders } = await loadFixture(delayFixture)
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

      const buyRequest = await buyAndWait(delay, token0, token1, wallet, {
        amountInMax: expandTo18Decimals(4),
        amountOut: expandTo18Decimals(1),
        gasLimit: 450000,
      })
      const botBalanceBefore = await other.getBalance()
      const tx = await delay.connect(other).execute(1, overrides)
      const { gasUsed, effectiveGasPrice } = await tx.wait()
      const botBalanceAfter = await other.getBalance()
      const botRefund = botBalanceAfter.sub(botBalanceBefore).add(gasUsed.mul(effectiveGasPrice))
      const tokenTransferCost = 60_000
      const minRefund = (await orders.ORDER_BASE_COST()).add(tokenTransferCost).mul(buyRequest.gasPrice)
      const maxRefund = BigNumber.from(buyRequest.gasLimit).mul(buyRequest.gasPrice)

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
        .to.emit(delay, 'EthRefund')
        .withArgs(other.address, true, botRefund)
      expect(botRefund).not.to.be.below(minRefund)
      expect(botRefund).not.to.be.above(maxRefund)
    })

    it('eth to user', async () => {
      const { delay, token0, token1, wallet, other, addLiquidity } = await loadFixture(delayFixture)
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

      await buyAndWait(delay, token0, token1, wallet, {
        amountInMax: expandTo18Decimals(4),
        amountOut: expandTo18Decimals(1),
        gasLimit: 450000,
      })
      const userBalanceBefore = await wallet.getBalance()
      const tx = await delay.connect(other).execute(1, overrides)
      const userBalanceAfter = await wallet.getBalance()
      const userRefund = userBalanceAfter.sub(userBalanceBefore)

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), userRefund)
        .to.emit(delay, 'EthRefund')
        .withArgs(wallet.address, true, userRefund)
    })

    it('token0', async () => {
      const { delay, token0, token1, wallet, other, addLiquidity } = await loadFixture(delayFixture)
      await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))

      const balanceBefore = await token0.balanceOf(wallet.address)
      const buyRequest = await buyAndWait(delay, token0, token1, wallet, {
        amountInMax: expandTo18Decimals(1),
        amountOut: expandTo18Decimals(4),
        gasLimit: 450000,
      })
      const balanceBetween = await token0.balanceOf(wallet.address)
      const tx = await delay.connect(other).execute(1, overrides)
      const balanceAfter = await token0.balanceOf(wallet.address)

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TD08'), getGasSpent(events[0]), getEthRefund(events[0]))
      expect(balanceBefore.sub(balanceBetween)).to.eq(buyRequest.amountInMax)
      expect(balanceAfter.sub(balanceBefore)).to.eq(0)
    })

    it('token1', async () => {
      const { delay, token0, token1, wallet, other, addLiquidity } = await loadFixture(delayFixture)
      await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))

      const balanceBefore = await token1.balanceOf(wallet.address)
      const buyRequest = await buyAndWait(delay, token1, token0, wallet, {
        amountInMax: expandTo18Decimals(1),
        amountOut: expandTo18Decimals(4),
        gasLimit: 450000,
      })
      const balanceBetween = await token1.balanceOf(wallet.address)
      const tx = await delay.connect(other).execute(1, overrides)
      const balanceAfter = await token1.balanceOf(wallet.address)

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TD08'), getGasSpent(events[0]), getEthRefund(events[0]))
      expect(balanceBefore.sub(balanceBetween)).to.eq(buyRequest.amountInMax)
      expect(balanceAfter.sub(balanceBefore)).to.eq(0)
    })

    it('weth', async () => {
      const { delay, weth, token, wallet, other, addLiquidityETH } = await loadFixture(delayFixture)
      await addLiquidityETH(expandTo18Decimals(100), expandTo18Decimals(100))

      const balanceBefore = await wallet.getBalance()
      const buyRequest = await buyAndWait(delay, weth, token, wallet, {
        etherAmount: expandTo18Decimals(1),
        amountInMax: expandTo18Decimals(1),
        amountOut: expandTo18Decimals(4),
        wrapUnwrap: true,
        gasLimit: 450000,
        gasPrice: BigNumber.from(0),
      })
      const balanceBetween = await wallet.getBalance()
      const tx = await delay.connect(other).execute(1, overrides)
      const balanceAfter = await wallet.getBalance()

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TD08'), getGasSpent(events[0]), getEthRefund(events[0]))
      expect(balanceBefore.sub(balanceBetween)).to.be.above(buyRequest.amountInMax)
      expect(balanceAfter.sub(balanceBetween)).to.eq(expandTo18Decimals(1))
    })
  })

  describe('refund extra amountIn', () => {
    it('token0 for token1', async () => {
      const { delay, addLiquidity, token0, token1, wallet, pair, oracle, getEncodedPriceInfo } = await loadFixture(
        delayFixture
      )
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

      const balanceBefore = await token0.balanceOf(wallet.address)
      const buy = await buyAndWait(delay, token0, token1, wallet, {
        amountOut: expandTo18Decimals(1),
        amountInMax: expandTo18Decimals(10),
        gasLimit: 600000,
      })

      const expectedAmountIn = await oracle.testGetSwapAmount0InMax(
        await pair.swapFee(),
        buy.amountOut,
        await getEncodedPriceInfo()
      )

      const tx = await delay.execute(1, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))

      const balanceAfter = await token0.balanceOf(wallet.address)
      expect(balanceBefore.sub(balanceAfter)).to.eq(expectedAmountIn)
    })

    it('token1 for token0', async () => {
      const { delay, addLiquidity, token0, token1, wallet, pair, oracle, getEncodedPriceInfo } = await loadFixture(
        delayFixture
      )
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

      const balanceBefore = await token1.balanceOf(wallet.address)
      const buy = await buyAndWait(delay, token1, token0, wallet, {
        amountOut: expandTo18Decimals(1),
        amountInMax: expandTo18Decimals(10),
        gasLimit: 600000,
      })

      const expectedAmountIn = await oracle.testGetSwapAmount1InMax(
        await pair.swapFee(),
        buy.amountOut,
        await getEncodedPriceInfo()
      )

      await delay.execute(1, overrides)

      const balanceAfter = await token1.balanceOf(wallet.address)
      expect(balanceBefore.sub(balanceAfter)).to.eq(expectedAmountIn)
    })

    it('amountInMax equals to amountIn', async () => {
      const { delay, addLiquidity, token0, token1, wallet, pair, oracle, getEncodedPriceInfo } = await loadFixture(
        delayFixture
      )
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

      const balanceBefore = await token1.balanceOf(wallet.address)
      const amountOut = expandTo18Decimals(1)

      const expectedAmountIn = await oracle.testGetSwapAmount1InMax(
        await pair.swapFee(),
        amountOut,
        await getEncodedPriceInfo(),
        overrides
      )

      await buyAndWait(delay, token1, token0, wallet, {
        amountOut,
        amountInMax: expectedAmountIn,
      })

      await delay.execute(1, overrides)

      const balanceAfter = await token1.balanceOf(wallet.address)
      expect(balanceBefore.sub(balanceAfter)).to.eq(expectedAmountIn)
    })

    it('unwrap ether', async () => {
      const { delay, addLiquidityETH, weth, token, wethPair, oracle, other, getEncodedPriceInfo } = await loadFixture(
        delayFixture
      )
      await addLiquidityETH(expandTo18Decimals(10), expandTo18Decimals(10))

      const balanceBefore = await other.getBalance()

      const buy = await buyAndWait(delay, weth, token, other, {
        amountOut: expandTo18Decimals(1),
        amountInMax: expandTo18Decimals(10),
        gasLimit: 600000,
        wrapUnwrap: true,
        etherAmount: expandTo18Decimals(10),
      })

      const expectedAmountIn =
        (await wethPair.token0()) == weth.address
          ? await oracle.testGetSwapAmount0InMax(await wethPair.swapFee(), buy.amountOut, await getEncodedPriceInfo())
          : await oracle.testGetSwapAmount1InMax(await wethPair.swapFee(), buy.amountOut, await getEncodedPriceInfo())

      await delay.execute(1, overrides)

      const balanceAfter = await other.getBalance()
      expect(balanceAfter.sub(balanceBefore).gt(buy.amountInMax.sub(expectedAmountIn))).to.be.true
    })

    it('token transfer fails', async () => {
      const { token0, token1, delay, addLiquidity, wallet } = await loadFixture(delayFailingFixture)
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))
      const buy = await buyAndWait(delay, token1, token0, wallet, {
        amountOut: expandTo18Decimals(1),
        amountInMax: expandTo18Decimals(10),
        gasLimit: 600000,
      })

      await token1.setWasteTransferGas(true, overrides)
      const tx = await delay.execute(1, overrides)
      const events = await getEvents(tx, 'OrderExecuted')

      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TH05'), getGasSpent(events[0]), getEthRefund(events[0]))
        .to.emit(delay, 'RefundFailed')
        .withArgs(wallet.address, token1.address, buy.amountInMax, encodeErrorData('TH05'))
    })

    it('unwrap fails', async () => {
      const { delay, addLiquidityETH, weth, token, wethPair, oracle, other, getEncodedPriceInfo } = await loadFixture(
        delayFixture
      )
      await addLiquidityETH(expandTo18Decimals(10), expandTo18Decimals(10))
      const etherHater = await new EtherHater__factory(other).deploy(overrides)
      const balanceBefore = await weth.balanceOf(etherHater.address)

      const etherAmount = expandTo18Decimals(10)
      const buy = await buyAndWait(delay, weth, token, etherHater, {
        amountOut: expandTo18Decimals(1),
        amountInMax: expandTo18Decimals(10),
        gasLimit: 600000,
        wrapUnwrap: true,
        etherAmount,
      })

      const expectedAmountIn =
        (await wethPair.token0()) == weth.address
          ? await oracle.testGetSwapAmount0InMax(await wethPair.swapFee(), buy.amountOut, await getEncodedPriceInfo())
          : await oracle.testGetSwapAmount1InMax(await wethPair.swapFee(), buy.amountOut, await getEncodedPriceInfo())
      const expectedWethTransfered = etherAmount.sub(expectedAmountIn)

      await expect(delay.execute(1, overrides))
        .to.emit(delay, 'UnwrapFailed')
        .withArgs(etherHater.address, expectedWethTransfered)

      const balanceAfter = await weth.balanceOf(etherHater.address)
      expect(balanceAfter.sub(balanceBefore)).to.eq(expectedWethTransfered)
    })
  })

  describe('mixed decimals partial execution', () => {
    const loadFixture = setupFixtureLoader()

    const decimals = [
      // [2, 18],
      // [4, 18],
      [6, 18],
      // [8, 18],
      // [10, 18],
      // [12, 18],
      // [14, 18],
      // [16, 18],
      // [18, 18],
      // [20, 18],
      // [22, 18],
      // [24, 18],

      // [2, 6],
      // [4, 6],
      // [6, 6],
      // [8, 6],
      // [10, 6],
      // [12, 6],
      // [14, 6],
      // [16, 6],
      // [18, 6],
      // [20, 6],
      // [22, 6],
      [24, 6],

      [2, 12],
      // [4, 12],
      // [6, 12],
      // [8, 12],
      // [10, 12],
      // [12, 12],
      // [14, 12],
      // [16, 12],
      // [18, 12],
      // [20, 12],
      // [22, 12],
      [24, 12],
    ]

    const reserves = [
      [11.274, 19.37171],
      // [8.572926, 15.48746262],
      // [5.251, 7.35791],
      // [2.12352361, 3.80791652]
    ]

    for (const [a, b] of decimals) {
      const permutations = [
        [a, b],
        [b, a],
      ]
      for (const [xDecimals, yDecimals] of permutations) {
        for (const [_r0, _r1] of reserves) {
          const [r0, r1] = [_r0.toFixed(xDecimals), _r1.toFixed(yDecimals)]

          const fixture = getDelayWithMixedDecimalsPairFixtureFor(xDecimals, yDecimals)

          it(`token0 (${xDecimals}) for token1 (${yDecimals}) with reserve0 (${r0}) and reserve1 (${r1})`, async () => {
            const { delay, token0, token1, pair, oracle, wallet, addLiquidity, getEncodedPriceInfo } =
              await loadFixture(fixture)
            const [reserve0, reserve1] = [expandToDecimals(r0, xDecimals), expandToDecimals(r1, yDecimals)]
            await addLiquidity(reserve0, reserve1)

            const [balanceBefore0, balanceBefore1] = [
              await token0.balanceOf(wallet.address),
              await token1.balanceOf(wallet.address),
            ]
            await buyAndWait(delay, token0, token1, wallet, {
              amountInMax: expandToDecimals(r0, xDecimals).add(1),
              amountOut: expandToDecimals(r1, yDecimals).add(1),
            })

            // Transfer doesn't affect trade
            await token0.transfer(delay.address, expandToDecimals(5, xDecimals), overrides)

            const reserveOut = reserve1.sub(1)
            const { amountOut } = await oracle.getSwapAmountInMinOut(
              false,
              await pair.swapFee(),
              reserveOut,
              await getEncodedPriceInfo()
            )

            const tx = await delay.execute(1, overrides)
            const [balanceAfter0, balanceAfter1] = [
              await token0.balanceOf(wallet.address),
              await token1.balanceOf(wallet.address),
            ]

            const events = await getEvents(tx, 'OrderExecuted')
            await expect(Promise.resolve(tx))
              .to.emit(delay, 'OrderExecuted')
              .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
              .to.emit(pair, 'Swap')
              .withArgs(delay.address, balanceBefore0.sub(balanceAfter0), 0, 0, amountOut, wallet.address)
            expect(balanceAfter1.sub(balanceBefore1)).to.eq(amountOut)
          })

          it(`token1 (${yDecimals}) for token0 (${xDecimals}) with reserve0 (${r0}) and reserve1 (${r1})`, async () => {
            const { delay, token0, token1, pair, oracle, wallet, addLiquidity, getEncodedPriceInfo } =
              await loadFixture(fixture)
            const [reserve0, reserve1] = [expandToDecimals(r0, xDecimals), expandToDecimals(r1, yDecimals)]
            await addLiquidity(reserve0, reserve1)

            const [balanceBefore0, balanceBefore1] = [
              await token0.balanceOf(wallet.address),
              await token1.balanceOf(wallet.address),
            ]
            await buyAndWait(delay, token1, token0, wallet, {
              amountInMax: expandToDecimals(r1, yDecimals).mul(2),
              amountOut: expandToDecimals(r0, xDecimals).add(1),
            })

            // Transfer doesn't affect trade
            await token1.transfer(delay.address, expandToDecimals(5, yDecimals), overrides)

            const reserveOut = reserve0.sub(1)
            const { amountOut } = await oracle.getSwapAmountInMinOut(
              true,
              await pair.swapFee(),
              reserveOut,
              await getEncodedPriceInfo()
            )

            const tx = await delay.execute(1, overrides)
            const [balanceAfter0, balanceAfter1] = [
              await token0.balanceOf(wallet.address),
              await token1.balanceOf(wallet.address),
            ]

            const events = await getEvents(tx, 'OrderExecuted')
            await expect(Promise.resolve(tx))
              .to.emit(delay, 'OrderExecuted')
              .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
              .to.emit(pair, 'Swap')
              .withArgs(delay.address, 0, balanceBefore1.sub(balanceAfter1), amountOut, 0, wallet.address)
            expect(balanceAfter0.sub(balanceBefore0)).to.eq(amountOut)
          })
        }
      }
    }
  })
})
