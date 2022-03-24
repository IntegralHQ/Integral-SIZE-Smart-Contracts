import { expect } from 'chai'
import { BigNumber, providers, utils } from 'ethers'
import { EtherHater__factory } from '../../build/types'
import { delayFixture } from '../shared/fixtures'
import { delayFailingFixture } from '../shared/fixtures/delayFailingFixture'
import { getDelayForPriceFixture } from '../shared/fixtures/getDelayForPriceFixture'
import { sellAndWait } from '../shared/orders'
import { setupFixtureLoader } from '../shared/setup'
import { encodeErrorData } from '../shared/solidityError'
import {
  expandTo18Decimals,
  getEthRefund,
  getEvents,
  getGasSpent,
  increaseTime,
  MIN_ALLOWED_GAS_LIMIT,
  ORDER_LIFESPAN_IN_HOURS,
  overrides,
  pairAddressToPairId,
} from '../shared/utilities'

describe('TwapDelay.executeSell', () => {
  const loadFixture = setupFixtureLoader()

  describe('execution', () => {
    it('removes the order from the queue', async () => {
      const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayFixture)

      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))
      await sellAndWait(delay, token0, token1, wallet, {
        gasLimit: 450000,
      })
      await delay.execute(1, overrides)

      expect(await delay.lastProcessedOrderId()).to.equal(1)
    })

    it('token0 for token1', async () => {
      const { delay, token0, token1, pair, wallet, addLiquidity, getEncodedPriceInfo } = await loadFixture(delayFixture)
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

      const balanceBefore = await token1.balanceOf(wallet.address)
      const sellRequest = await sellAndWait(delay, token0, token1, wallet, {
        gasLimit: 450000,
      })

      const expectedAmountOut = await pair.getSwapAmount1Out(sellRequest.amountIn, await getEncodedPriceInfo())
      const tx = await delay.execute(1, overrides)
      const balanceAfter = await token1.balanceOf(wallet.address)

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      expect(balanceAfter.sub(balanceBefore)).to.eq(expectedAmountOut)
    })

    it('token1 for token0', async () => {
      const { delay, token0, token1, pair, wallet, getEncodedPriceInfo, addLiquidity } = await loadFixture(delayFixture)
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

      const balanceBefore = await token0.balanceOf(wallet.address)
      const sellRequest = await sellAndWait(delay, token1, token0, wallet, {
        gasLimit: 450000,
      })

      const expectedAmountOut = await pair.getSwapAmount0Out(sellRequest.amountIn, await getEncodedPriceInfo())
      const tx = await delay.execute(1, overrides)
      const balanceAfter = await token0.balanceOf(wallet.address)

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      expect(balanceAfter.sub(balanceBefore)).to.eq(expectedAmountOut)
    })

    it('token for weth', async () => {
      const { delay, weth, token, wethPair, wallet, addLiquidityETH, getEncodedPriceInfo } = await loadFixture(
        delayFixture
      )
      await addLiquidityETH(expandTo18Decimals(10), expandTo18Decimals(10))

      const tokenFirst = weth.address.toLowerCase() > token.address.toLowerCase()
      const sellRequest = await sellAndWait(delay, token, weth, wallet, {
        gasLimit: 450000,
        wrapUnwrap: true,
      })

      const expectedAmountOut = tokenFirst
        ? await wethPair.getSwapAmount1Out(sellRequest.amountIn, await getEncodedPriceInfo())
        : await wethPair.getSwapAmount0Out(sellRequest.amountIn, await getEncodedPriceInfo())
      const balanceBefore = await wallet.getBalance()
      const tx = await delay.execute(1, overrides)
      const balanceAfter = await wallet.getBalance()

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      expect(balanceAfter.sub(balanceBefore)).to.be.gt(expectedAmountOut)
    })

    it('does not modify the order if tokens are transferred to pair', async () => {
      const { delay, token0, token1, pair, other, addLiquidity } = await loadFixture(getDelayForPriceFixture(1))
      await addLiquidity(expandTo18Decimals(1000), expandTo18Decimals(1000))

      await token0.transfer(other.address, expandTo18Decimals(100), overrides)

      await sellAndWait(delay, token0, token1, other, {
        amountIn: expandTo18Decimals(1),
        amountOutMin: expandTo18Decimals(0),
        gasLimit: 450000,
      })
      await increaseTime(other)
      await token0.transfer(pair.address, expandTo18Decimals(100), overrides)

      const tx = await delay.execute(1, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      const [, reserve1] = await pair.getReserves()
      expect(reserve1.gte(expandTo18Decimals(999))).to.be.true
    })
  })

  describe('errors', () => {
    it('insufficient output 0 amount', async () => {
      const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayFixture)
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

      await sellAndWait(delay, token1, token0, wallet, {
        amountOutMin: expandTo18Decimals(2),
        gasLimit: 450000,
      })

      const tx = await delay.execute(1, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TD37'), getGasSpent(events[0]), getEthRefund(events[0]))
    })

    it('insufficient output 1 amount', async () => {
      const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayFixture)
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

      await sellAndWait(delay, token0, token1, wallet, {
        amountOutMin: expandTo18Decimals(2),
        gasLimit: 450000,
      })

      const tx = await delay.execute(1, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TD37'), getGasSpent(events[0]), getEthRefund(events[0]))
    })

    it('hits the 48 hours deadline', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)

      await sellAndWait(delay, token0, token1, wallet, {
        gasLimit: 450000,
      })
      await (delay.provider as providers.JsonRpcProvider).send('evm_increaseTime', [ORDER_LIFESPAN_IN_HOURS * 60 * 60])

      const tx = await delay.execute(1, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TD04'), getGasSpent(events[0]), getEthRefund(events[0]))
    })

    it('out of gas', async () => {
      const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayFixture)
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

      await sellAndWait(delay, token1, token0, wallet, { gasLimit: MIN_ALLOWED_GAS_LIMIT })

      const tx = await delay.execute(1, overrides)
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
      const sell = await sellAndWait(delay, token0, token1, wallet, {
        gasLimit: 450000,
      })

      await token0.setWasteTransferGas(true, overrides)
      const tx = await delay.execute(1, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TH05'), getGasSpent(events[0]), getEthRefund(events[0]))
        .to.emit(delay, 'RefundFailed')
        .withArgs(sell.to, token0.address, sell.amountIn, encodeErrorData('TH05'))

      const orderInQueue = await delay.getSellOrder(1, overrides)
      const order = [
        pairAddressToPairId(pair.address),
        false,
        sell.amountIn,
        sell.amountOutMin,
        sell.wrapUnwrap,
        sell.to,
        sell.gasPrice,
        BigNumber.from(sell.gasLimit),
        orderInQueue.validAfterTimestamp,
        orderInQueue.priceAccumulator,
        orderInQueue.timestamp,
      ]
      expect(order).to.deep.eq(orderInQueue)
      expect(await delay.lastProcessedOrderId()).to.eq(1)
      expect(await delay.newestOrderId()).to.eq(1)
    })

    it('cannot unwrap WETH', async () => {
      const { delay, weth, token, wallet, other, addLiquidityETH } = await loadFixture(delayFixture)
      await addLiquidityETH(expandTo18Decimals(100), expandTo18Decimals(100))

      const etherHater = await new EtherHater__factory(wallet).deploy(overrides)

      const sellRequest = await sellAndWait(delay, token, weth, etherHater, {
        gasLimit: 470000,
        amountOutMin: expandTo18Decimals(1),
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
      expect(wethBalanceAfter.sub(wethBalanceBefore).gt(sellRequest.amountOutMin)).to.be.true
    })
  })

  describe('refund', () => {
    it('eth to bot', async () => {
      const { delay, token0, token1, wallet, other, addLiquidity, orders } = await loadFixture(delayFixture)
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

      const sellRequest = await sellAndWait(delay, token0, token1, wallet, {
        gasLimit: 450000,
      })
      const botBalanceBefore = await other.getBalance()
      const tx = await delay.connect(other).execute(1, overrides)
      const { gasUsed, effectiveGasPrice } = await tx.wait()
      const botBalanceAfter = await other.getBalance()
      const botRefund = botBalanceAfter.sub(botBalanceBefore).add(gasUsed.mul(effectiveGasPrice))
      const tokenTransferCost = 60_000
      const minRefund = (await orders.ORDER_BASE_COST()).add(tokenTransferCost).mul(sellRequest.gasPrice)
      const maxRefund = BigNumber.from(sellRequest.gasLimit).mul(sellRequest.gasPrice)

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

      await sellAndWait(delay, token0, token1, wallet, {
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
      const sellRequest = await sellAndWait(delay, token0, token1, wallet, {
        gasLimit: 450000,
        amountOutMin: expandTo18Decimals(10),
      })
      const balanceBetween = await token0.balanceOf(wallet.address)
      const tx = await delay.connect(other).execute(1, overrides)
      const balanceAfter = await token0.balanceOf(wallet.address)

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TD37'), getGasSpent(events[0]), getEthRefund(events[0]))
      expect(balanceBefore.sub(balanceBetween)).to.eq(sellRequest.amountIn)
      expect(balanceAfter.sub(balanceBefore)).to.eq(0)
    })

    it('token1', async () => {
      const { delay, token0, token1, wallet, other, addLiquidity } = await loadFixture(delayFixture)
      await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))

      const balanceBefore = await token1.balanceOf(wallet.address)
      const sellRequest = await sellAndWait(delay, token1, token0, wallet, {
        gasLimit: 450000,
        amountOutMin: expandTo18Decimals(10),
      })
      const balanceBetween = await token1.balanceOf(wallet.address)
      const tx = await delay.connect(other).execute(1, overrides)
      const balanceAfter = await token1.balanceOf(wallet.address)

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TD37'), getGasSpent(events[0]), getEthRefund(events[0]))
      expect(balanceBefore.sub(balanceBetween)).to.eq(sellRequest.amountIn)
      expect(balanceAfter.sub(balanceBefore)).to.eq(0)
    })

    it('weth', async () => {
      const { delay, weth, token, wallet, other, addLiquidityETH } = await loadFixture(delayFixture)
      await addLiquidityETH(expandTo18Decimals(100), expandTo18Decimals(100))

      const balanceBefore = await wallet.getBalance()
      const sellRequest = await sellAndWait(delay, weth, token, wallet, {
        gasLimit: 450000,
        amountOutMin: expandTo18Decimals(10),
        etherAmount: expandTo18Decimals(1),
        wrapUnwrap: true,
        gasPrice: 0,
      })
      const balanceBetween = await wallet.getBalance()
      const tx = await delay.connect(other).execute(1, overrides)
      const balanceAfter = await wallet.getBalance()

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TD37'), getGasSpent(events[0]), getEthRefund(events[0]))
      expect(balanceBefore.sub(balanceBetween)).to.be.above(sellRequest.amountIn)
      expect(balanceAfter.sub(balanceBetween)).to.eq(expandTo18Decimals(1))
    })

    it('if ether refund fails order is still in queue', async () => {
      const { delay, token, wallet, weth, addLiquidityETH, wethPair } = await loadFixture(delayFixture)
      await addLiquidityETH(expandTo18Decimals(100), expandTo18Decimals(100))
      const etherHater = await new EtherHater__factory(wallet).deploy(overrides)

      const sell = await sellAndWait(delay, weth, token, wallet, {
        to: etherHater.address,
        wrapUnwrap: true,
        gasLimit: 200000,
        etherAmount: utils.parseEther('2'),
        amountIn: utils.parseEther('2'),
      })

      const tx = await delay.execute(1, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
        .to.emit(delay, 'RefundFailed')
        .withArgs(etherHater.address, weth.address, utils.parseEther('2'), encodeErrorData('TH3F'))

      const orderInQueue = await delay.getSellOrder(1, overrides)
      const order = [
        pairAddressToPairId(wethPair.address),
        BigNumber.from(weth.address).gt(BigNumber.from(token.address)),
        sell.amountIn,
        sell.amountOutMin,
        sell.wrapUnwrap,
        sell.to,
        sell.gasPrice,
        BigNumber.from(sell.gasLimit),
        orderInQueue.validAfterTimestamp,
        orderInQueue.priceAccumulator,
        orderInQueue.timestamp,
      ]
      expect(order).to.deep.eq(orderInQueue)
      expect(await delay.lastProcessedOrderId()).to.eq(1)
      expect(await delay.newestOrderId()).to.eq(1)
    })
  })
})
