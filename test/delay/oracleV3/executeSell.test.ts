import { expect } from 'chai'
import { BigNumber, utils } from 'ethers'
import { EtherHater__factory } from '../../../build/types'
import { delayOracleV3Fixture } from '../../shared/fixtures'
import { delayFailingOracleV3Fixture } from '../../shared/fixtures/delayFailingOracleV3Fixture'
import { getDelayWithMixedDecimalsPoolFixtureFor } from '../../shared/fixtures/delayWithMixedDecimalsPoolFixture'
import { getDelayForPriceOracleV3Fixture } from '../../shared/fixtures/getDelayForPriceOracleV3Fixture'
import { getOrderDigest, sellAndWait } from '../../shared/orders'
import { setupFixtureLoader } from '../../shared/setup'
import { encodeErrorData } from '../../shared/solidityError'
import {
  expandTo18Decimals,
  expandToDecimals,
  getEthRefund,
  getEvents,
  getGasSpent,
  increaseTime,
  overrides,
} from '../../shared/utilities'

describe('TwapDelay.executeSell.oracleV3', () => {
  const loadFixture = setupFixtureLoader()

  describe('execution', () => {
    it('removes the order from the queue', async () => {
      const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayOracleV3Fixture)

      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))
      const sellResult = await sellAndWait(delay, token0, token1, wallet, {
        gasLimit: 450000,
      })
      await delay.execute(sellResult.orderData, overrides)

      expect(await delay.lastProcessedOrderId()).to.equal(1)
    })

    it('token0 for token1', async () => {
      const { delay, token0, token1, pair, oracle, wallet, addLiquidity, getEncodedPriceInfo } = await loadFixture(
        delayOracleV3Fixture
      )
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

      const balanceBefore = await token1.balanceOf(wallet.address)
      const sellResult = await sellAndWait(delay, token0, token1, wallet, {
        gasLimit: 450000,
      })

      const expectedAmountOut = await oracle.getSwapAmount1Out(
        await pair.swapFee(),
        sellResult.amountIn,
        await getEncodedPriceInfo()
      )
      const tx = await delay.execute(sellResult.orderData, overrides)
      const balanceAfter = await token1.balanceOf(wallet.address)

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      expect(balanceAfter.sub(balanceBefore)).to.eq(expectedAmountOut)
    })

    it('token1 for token0', async () => {
      const { delay, token0, token1, pair, oracle, wallet, getEncodedPriceInfo, addLiquidity } = await loadFixture(
        delayOracleV3Fixture
      )
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

      const balanceBefore = await token0.balanceOf(wallet.address)
      const sellResult = await sellAndWait(delay, token1, token0, wallet, {
        gasLimit: 450000,
      })

      const expectedAmountOut = await oracle.getSwapAmount0Out(
        await pair.swapFee(),
        sellResult.amountIn,
        await getEncodedPriceInfo()
      )
      const tx = await delay.execute(sellResult.orderData, overrides)
      const balanceAfter = await token0.balanceOf(wallet.address)

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      expect(balanceAfter.sub(balanceBefore)).to.eq(expectedAmountOut)
    })

    it('token for weth', async () => {
      const { delay, weth, token, wethPair, oracle, wallet, addLiquidityETH, getEncodedPriceInfo } = await loadFixture(
        delayOracleV3Fixture
      )
      await addLiquidityETH(expandTo18Decimals(10), expandTo18Decimals(10))

      const tokenFirst = weth.address.toLowerCase() > token.address.toLowerCase()
      const sellResult = await sellAndWait(delay, token, weth, wallet, {
        gasLimit: 450000,
        wrapUnwrap: true,
      })

      const expectedAmountOut = tokenFirst
        ? await oracle.getSwapAmount1Out(await wethPair.swapFee(), sellResult.amountIn, await getEncodedPriceInfo())
        : await oracle.getSwapAmount0Out(await wethPair.swapFee(), sellResult.amountIn, await getEncodedPriceInfo())
      const balanceBefore = await wallet.getBalance()
      const tx = await delay.execute(sellResult.orderData, overrides)
      const balanceAfter = await wallet.getBalance()

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      expect(balanceAfter.sub(balanceBefore)).to.be.gt(expectedAmountOut)
    })

    it('does not modify the order if tokens are transferred to pair', async () => {
      const { delay, token0, token1, pair, other, addLiquidity } = await loadFixture(
        getDelayForPriceOracleV3Fixture(1, 1)
      )
      await addLiquidity(expandTo18Decimals(1000), expandTo18Decimals(1000))

      await token0.transfer(other.address, expandTo18Decimals(100), overrides)

      const sellResult = await sellAndWait(delay, token0, token1, other, {
        amountIn: expandTo18Decimals(1),
        amountOutMin: expandTo18Decimals(0),
        gasLimit: 450000,
      })
      await increaseTime(other)
      await token0.transfer(pair.address, expandTo18Decimals(100), overrides)

      const tx = await delay.execute(sellResult.orderData, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      const [, reserve1] = await pair.getReserves()
      expect(reserve1.gte(expandTo18Decimals(999))).to.be.true
    })
  })

  describe('partial execution', () => {
    it('token0 for token1', async () => {
      const { delay, token0, token1, pair, oracle, wallet, addLiquidity, getEncodedPriceInfo } = await loadFixture(
        delayOracleV3Fixture
      )
      const [reserve0, reserve1] = [expandTo18Decimals(10), expandTo18Decimals(10)]
      await addLiquidity(reserve0, reserve1)

      const [balanceBefore0, balanceBefore1] = [
        await token0.balanceOf(wallet.address),
        await token1.balanceOf(wallet.address),
      ]
      const sellResult = await sellAndWait(delay, token0, token1, wallet, {
        gasLimit: 450000,
        amountIn: expandTo18Decimals(11),
        amountOutMin: expandTo18Decimals(11),
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

      const tx = await delay.execute(sellResult.orderData, overrides)
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
        delayOracleV3Fixture
      )
      const [reserve0, reserve1] = [expandTo18Decimals(10), expandTo18Decimals(10)]
      await addLiquidity(reserve0, reserve1)

      const [balanceBefore0, balanceBefore1] = [
        await token0.balanceOf(wallet.address),
        await token1.balanceOf(wallet.address),
      ]
      const sellResult = await sellAndWait(delay, token1, token0, wallet, {
        gasLimit: 450000,
        amountIn: expandTo18Decimals(200),
        amountOutMin: expandTo18Decimals(90),
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

      const tx = await delay.execute(sellResult.orderData, overrides)
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
      const { delay, weth, token, wethPair, oracle, wallet, addLiquidityETH, getEncodedPriceInfo } = await loadFixture(
        delayOracleV3Fixture
      )
      const [reserveToken, reserveEth] = [expandTo18Decimals(10), expandTo18Decimals(10)]
      await addLiquidityETH(reserveToken, reserveEth)

      const balanceBeforeToken = await token.balanceOf(wallet.address)
      const sellResult = await sellAndWait(delay, token, weth, wallet, {
        gasLimit: 450000,
        amountIn: expandTo18Decimals(200),
        amountOutMin: expandTo18Decimals(200),
        wrapUnwrap: true,
      })

      // Transfer doesn't affect trade
      await token.transfer(delay.address, expandTo18Decimals(5), overrides)

      const balanceBeforeEth = await wallet.getBalance()

      const reserveOut = reserveEth.sub(1)
      const { amountOut } = await oracle.getSwapAmountInMinOut(
        token.address.toLowerCase() > weth.address.toLowerCase(),
        await wethPair.swapFee(),
        reserveOut,
        await getEncodedPriceInfo()
      )

      const tx = await delay.execute(sellResult.orderData, overrides)
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
      const { delay, weth, token, wethPair, wallet, addLiquidityETH, oracle, getEncodedPriceInfo } = await loadFixture(
        delayOracleV3Fixture
      )
      const [reserveToken, reserveEth] = [expandTo18Decimals(10), expandTo18Decimals(10)]
      await addLiquidityETH(reserveToken, reserveEth)

      const balanceBeforeToken = await token.balanceOf(wallet.address)
      const sellResult = await sellAndWait(delay, weth, token, wallet, {
        gasLimit: 450000,
        etherAmount: expandTo18Decimals(200),
        amountIn: expandTo18Decimals(200),
        amountOutMin: expandTo18Decimals(90),
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

      const tx = await delay.execute(sellResult.orderData, overrides)
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
    it('insufficient output 0 amount', async () => {
      const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayOracleV3Fixture)
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

      const sellResult = await sellAndWait(delay, token1, token0, wallet, {
        amountOutMin: expandTo18Decimals(2),
        gasLimit: 450000,
      })

      const tx = await delay.execute(sellResult.orderData, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TD37'), getGasSpent(events[0]), getEthRefund(events[0]))
    })

    it('insufficient output 1 amount', async () => {
      const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayOracleV3Fixture)
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

      const sellResult = await sellAndWait(delay, token0, token1, wallet, {
        amountOutMin: expandTo18Decimals(2),
        gasLimit: 450000,
      })

      const tx = await delay.execute(sellResult.orderData, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TD37'), getGasSpent(events[0]), getEthRefund(events[0]))
    })

    it('if token refund fails order is still in queue', async () => {
      const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayFailingOracleV3Fixture)

      await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
      const sell = await sellAndWait(delay, token0, token1, wallet, {
        gasLimit: 450000,
      })

      await token0.setWasteTransferGas(true, overrides)
      const tx = await delay.execute(sell.orderData, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TH05'), getGasSpent(events[0]), getEthRefund(events[0]))
        .to.emit(delay, 'RefundFailed')
        .withArgs(sell.to, token0.address, sell.amountIn, encodeErrorData('TH05'))

      const orderHashOnChain = await delay.getOrderHash(1, overrides)
      const orderHash = getOrderDigest(sell.orderData[0])
      expect(orderHash).to.be.eq(orderHashOnChain)
      expect(await delay.lastProcessedOrderId()).to.eq(1)
      expect(await delay.newestOrderId()).to.eq(1)
    })

    it('cannot unwrap WETH', async () => {
      const { delay, weth, token, wallet, other, addLiquidityETH } = await loadFixture(delayOracleV3Fixture)
      await addLiquidityETH(expandTo18Decimals(100), expandTo18Decimals(100))

      const etherHater = await new EtherHater__factory(wallet).deploy(overrides)

      const sellResult = await sellAndWait(delay, token, weth, etherHater, {
        gasLimit: 470000,
        amountOutMin: expandTo18Decimals(1),
        wrapUnwrap: true,
      })

      const wethBalanceBefore = await weth.balanceOf(etherHater.address)
      const balanceBefore = await wallet.provider.getBalance(etherHater.address)
      const tx = await delay.connect(other).execute(sellResult.orderData, overrides)
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
      expect(wethBalanceAfter.sub(wethBalanceBefore).gt(sellResult.amountOutMin)).to.be.true
    })
  })

  describe('refund', () => {
    it('eth to bot', async () => {
      const { delay, token0, token1, wallet, other, addLiquidity, orders } = await loadFixture(delayOracleV3Fixture)
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

      const sellResult = await sellAndWait(delay, token0, token1, wallet, {
        gasLimit: 450000,
      })
      const botBalanceBefore = await other.getBalance()
      const tx = await delay.connect(other).execute(sellResult.orderData, overrides)
      const { gasUsed, effectiveGasPrice } = await tx.wait()
      const botBalanceAfter = await other.getBalance()
      const botRefund = botBalanceAfter.sub(botBalanceBefore).add(gasUsed.mul(effectiveGasPrice))
      const tokenTransferCost = 60_000
      const minRefund = (await orders.ORDER_BASE_COST()).add(tokenTransferCost).mul(sellResult.gasPrice)
      const maxRefund = BigNumber.from(sellResult.gasLimit).mul(sellResult.gasPrice)

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
      const { delay, token0, token1, wallet, other, addLiquidity } = await loadFixture(delayOracleV3Fixture)
      await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(10))

      const sellResult = await sellAndWait(delay, token0, token1, wallet, {
        gasLimit: 450000,
      })
      const userBalanceBefore = await wallet.getBalance()
      const tx = await delay.connect(other).execute(sellResult.orderData, overrides)
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
      const { delay, token0, token1, wallet, other, addLiquidity } = await loadFixture(delayOracleV3Fixture)
      await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))

      const balanceBefore = await token0.balanceOf(wallet.address)
      const sellResult = await sellAndWait(delay, token0, token1, wallet, {
        gasLimit: 450000,
        amountOutMin: expandTo18Decimals(10),
      })
      const balanceBetween = await token0.balanceOf(wallet.address)
      const tx = await delay.connect(other).execute(sellResult.orderData, overrides)
      const balanceAfter = await token0.balanceOf(wallet.address)

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TD37'), getGasSpent(events[0]), getEthRefund(events[0]))
      expect(balanceBefore.sub(balanceBetween)).to.eq(sellResult.amountIn)
      expect(balanceAfter.sub(balanceBefore)).to.eq(0)
    })

    it('token1', async () => {
      const { delay, token0, token1, wallet, other, addLiquidity } = await loadFixture(delayOracleV3Fixture)
      await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))

      const balanceBefore = await token1.balanceOf(wallet.address)
      const sellResult = await sellAndWait(delay, token1, token0, wallet, {
        gasLimit: 450000,
        amountOutMin: expandTo18Decimals(10),
      })
      const balanceBetween = await token1.balanceOf(wallet.address)
      const tx = await delay.connect(other).execute(sellResult.orderData, overrides)
      const balanceAfter = await token1.balanceOf(wallet.address)

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TD37'), getGasSpent(events[0]), getEthRefund(events[0]))
      expect(balanceBefore.sub(balanceBetween)).to.eq(sellResult.amountIn)
      expect(balanceAfter.sub(balanceBefore)).to.eq(0)
    })

    it('weth', async () => {
      const { delay, weth, token, wallet, other, addLiquidityETH } = await loadFixture(delayOracleV3Fixture)
      await addLiquidityETH(expandTo18Decimals(100), expandTo18Decimals(100))

      const balanceBefore = await wallet.getBalance()
      const sellResult = await sellAndWait(delay, weth, token, wallet, {
        gasLimit: 450000,
        amountOutMin: expandTo18Decimals(10),
        etherAmount: expandTo18Decimals(1),
        wrapUnwrap: true,
        gasPrice: 0,
      })
      const balanceBetween = await wallet.getBalance()
      const tx = await delay.connect(other).execute(sellResult.orderData, overrides)
      const balanceAfter = await wallet.getBalance()

      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TD37'), getGasSpent(events[0]), getEthRefund(events[0]))
      expect(balanceBefore.sub(balanceBetween)).to.be.above(sellResult.amountIn)
      expect(balanceAfter.sub(balanceBetween)).to.eq(expandTo18Decimals(1))
    })

    it('if ether refund fails order is still in queue', async () => {
      const { delay, token, wallet, weth, addLiquidityETH } = await loadFixture(delayOracleV3Fixture)
      await addLiquidityETH(expandTo18Decimals(100), expandTo18Decimals(100))
      const etherHater = await new EtherHater__factory(wallet).deploy(overrides)

      const sell = await sellAndWait(delay, weth, token, wallet, {
        to: etherHater.address,
        wrapUnwrap: true,
        gasLimit: 200000,
        etherAmount: utils.parseEther('2'),
        amountIn: utils.parseEther('2'),
      })

      const tx = await delay.execute(sell.orderData, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
        .to.emit(delay, 'RefundFailed')
        .withArgs(etherHater.address, weth.address, utils.parseEther('2'), encodeErrorData('TH3F'))

      const orderHashOnChain = await delay.getOrderHash(1, overrides)
      const orderHash = getOrderDigest(sell.orderData[0])
      expect(orderHash).to.be.eq(orderHashOnChain)
      expect(await delay.lastProcessedOrderId()).to.eq(1)
      expect(await delay.newestOrderId()).to.eq(1)
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
      // [24, 12],
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

          const fixture = getDelayWithMixedDecimalsPoolFixtureFor(xDecimals, yDecimals)

          it(`token0 (${xDecimals}) for token1 (${yDecimals}) with reserve0 (${r0}) and reserve1 (${r1})`, async () => {
            const { delay, token0, token1, pair, oracle, wallet, addLiquidity, getEncodedPriceInfo, setupUniswapPool } =
              await loadFixture(fixture)
            await setupUniswapPool(expandToDecimals(1, xDecimals), expandToDecimals(2, yDecimals))
            const [reserve0, reserve1] = [expandToDecimals(r0, xDecimals), expandToDecimals(r1, yDecimals)]
            await addLiquidity(reserve0, reserve1)

            const [balanceBefore0, balanceBefore1] = [
              await token0.balanceOf(wallet.address),
              await token1.balanceOf(wallet.address),
            ]
            const sellResult = await sellAndWait(delay, token0, token1, wallet, {
              gasLimit: 450000,
              amountIn: expandToDecimals(r0, xDecimals),
              amountOutMin: expandToDecimals(r1, yDecimals).add(1),
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

            const tx = await delay.execute(sellResult.orderData, overrides)
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
            const { delay, token0, token1, pair, oracle, wallet, addLiquidity, getEncodedPriceInfo, setupUniswapPool } =
              await loadFixture(fixture)
            await setupUniswapPool(expandToDecimals(1, xDecimals), expandToDecimals(2, yDecimals))
            const [reserve0, reserve1] = [expandToDecimals(r0, xDecimals), expandToDecimals(r1, yDecimals)]
            await addLiquidity(reserve0, reserve1)

            const [balanceBefore0, balanceBefore1] = [
              await token0.balanceOf(wallet.address),
              await token1.balanceOf(wallet.address),
            ]
            const sellResult = await sellAndWait(delay, token1, token0, wallet, {
              gasLimit: 450000,
              amountIn: expandToDecimals(r1, yDecimals).mul(2),
              amountOutMin: expandToDecimals(r0, xDecimals).add(1),
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

            const tx = await delay.execute(sellResult.orderData, overrides)
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
