import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { depositAndWait } from '../../shared/orders'
import { delayOracleV3Fixture } from '../../shared/fixtures'
import { setupFixtureLoader } from '../../shared/setup'
import { encodeErrorData } from '../../shared/solidityError'
import {
  expandTo18Decimals,
  expandToDecimals,
  getEthRefund,
  getEvents,
  getGasSpent,
  makeFloatEncodable,
  overrides,
} from '../../shared/utilities'
import { delayWithMixedDecimalsPoolFixture } from '../../shared/fixtures/delayWithMixedDecimalsPoolFixture'
import { parseUnits } from 'ethers/lib/utils'
import { getDelayForPriceOracleV3Fixture } from '../../shared/fixtures/getDelayForPriceOracleV3Fixture'

describe('TwapDelay.executeDeposit.oracleV3', () => {
  const loadFixture = setupFixtureLoader()

  describe('success', () => {
    it('mints initial liquidity', async () => {
      const { delay, token0, token1, wallet, pair, MINIMUM_LIQUIDITY, MINT_FEE, PRECISION } = await loadFixture(
        delayOracleV3Fixture
      )

      const balanceBefore = await pair.balanceOf(wallet.address)
      const token0BalanceBefore = await token0.balanceOf(wallet.address)
      const token1BalanceBefore = await token1.balanceOf(wallet.address)

      const depositResult = await depositAndWait(delay, token0, token1, wallet)

      const expectedLiquidity = depositResult.amount0
      const expectedFee = expectedLiquidity.sub(MINIMUM_LIQUIDITY).mul(MINT_FEE).div(PRECISION)

      const tx = await delay.execute(depositResult.orderData, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))

      const balanceAfter = await pair.balanceOf(wallet.address)
      const token0BalanceAfter = await token0.balanceOf(wallet.address)
      const token1BalanceAfter = await token1.balanceOf(wallet.address)

      expect(balanceAfter.sub(balanceBefore)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY).sub(expectedFee))
      expect(token0BalanceBefore.sub(token0BalanceAfter)).to.eq(depositResult.amount0)
      expect(token1BalanceBefore.sub(token1BalanceAfter)).to.eq(depositResult.amount1)
    })

    const cases = [
      // equal reserves
      { reserve0: 100, reserve1: 100, amount0: 10, amount1: 40 },
      { reserve0: 100, reserve1: 100, amount0: 40, amount1: 10 },
      { reserve0: 100, reserve1: 100, amount0: 40, amount1: 40 },
      { reserve0: 100, reserve1: 100, amount0: 0, amount1: 40 },
      { reserve0: 100, reserve1: 100, amount0: 40, amount1: 0 },

      // reserve 0 is bigger
      { reserve0: 200, reserve1: 100, amount0: 10, amount1: 40 },
      { reserve0: 200, reserve1: 100, amount0: 40, amount1: 10 },
      { reserve0: 200, reserve1: 100, amount0: 40, amount1: 40 },
      { reserve0: 200, reserve1: 100, amount0: 0, amount1: 40 },
      { reserve0: 200, reserve1: 100, amount0: 40, amount1: 0 },

      // reserve 1 is bigger
      { reserve0: 100, reserve1: 200, amount0: 10, amount1: 40 },
      { reserve0: 100, reserve1: 200, amount0: 40, amount1: 10 },
      { reserve0: 100, reserve1: 200, amount0: 40, amount1: 40 },
      { reserve0: 100, reserve1: 200, amount0: 0, amount1: 40 },
      { reserve0: 100, reserve1: 200, amount0: 40, amount1: 0 },

      // one reserve is very small
      { reserve0: 0.00001, reserve1: 200, amount0: 40, amount1: 40 },
      { reserve0: 0.00001, reserve1: 200, amount0: 40, amount1: 0 },
      { reserve0: 0.00001, reserve1: 200, amount0: 0, amount1: 40 },
    ]

    for (const { reserve0, reserve1, amount0, amount1 } of cases) {
      it(`reserves: (${reserve0}, ${reserve1}) + amounts: (${amount0}, ${amount1})`, async () => {
        const { delay, token0, token1, wallet, pair, addLiquidity } = await loadFixture(delayOracleV3Fixture)

        await addLiquidity(expandTo18Decimals(reserve0), expandTo18Decimals(reserve1))
        const depositResult = await depositAndWait(delay, token0, token1, wallet, {
          amount0: expandTo18Decimals(amount0),
          amount1: expandTo18Decimals(amount1),
          gasLimit: 700_000,
        })

        const price = 2
        const initialLiquidity = Math.sqrt(reserve0 * reserve1)
        const expectedLiquidityNumber = initialLiquidity * ((amount0 * price + amount1) / (reserve0 * price + reserve1))
        const expectedLiquidity = expandTo18Decimals(expectedLiquidityNumber)

        const liquidityBefore = await pair.balanceOf(wallet.address)
        const balance0Before = await token0.balanceOf(wallet.address)
        const balance1Before = await token1.balanceOf(wallet.address)

        const tx = await delay.execute(depositResult.orderData, overrides)
        const events = await getEvents(tx, 'OrderExecuted')
        await expect(Promise.resolve(tx))
          .to.emit(delay, 'OrderExecuted')
          .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))

        const liquidityAfter = await pair.balanceOf(wallet.address)
        const balance0After = await token0.balanceOf(wallet.address)
        const balance1After = await token1.balanceOf(wallet.address)

        // between 99% and 101% of expected liquidity
        const liquidity = liquidityAfter.sub(liquidityBefore)
        const expected99Percent = expectedLiquidity.mul(99).div(100)
        const expected101Percent = expectedLiquidity.mul(101).div(100)
        expect(liquidity.gte(expected99Percent), 'too little liquidity').to.be.true
        expect(liquidity.lte(expected101Percent), 'too much liquidity').to.be.true
        // one small refund
        const token0Refund = balance0After.sub(balance0Before)
        const token1Refund = balance1After.sub(balance1Before)
        expect(token0Refund.isZero() || token1Refund.isZero(), 'at least one refund is non-zero').to.be.true
        expect(token0Refund.lt(expandTo18Decimals(0.01 * amount0 || 1)), 'refund 0 too large').to.be.true
        expect(token1Refund.lt(expandTo18Decimals(0.01 * amount1 || 1)), 'refund 1 too large').to.be.true
      })
    }

    it('does not swap when swap is set to false', async () => {
      const { delay, token0, token1, wallet, factory, pair, addLiquidity } = await loadFixture(delayOracleV3Fixture)

      await factory.setMintFee(token0.address, token1.address, 0, overrides)

      await addLiquidity(expandTo18Decimals(200), expandTo18Decimals(100))
      const depositResult = await depositAndWait(delay, token0, token1, wallet, {
        amount0: expandTo18Decimals(300),
        amount1: expandTo18Decimals(100),
        swap: false,
      })

      const balance0Before = await token0.balanceOf(wallet.address)
      const balance1Before = await token1.balanceOf(wallet.address)

      const tx = await delay.execute(depositResult.orderData, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))

      const balance0After = await token0.balanceOf(wallet.address)
      const balance1After = await token1.balanceOf(wallet.address)

      const [reserve0, reserve1] = await pair.getReserves()
      expect(reserve0).to.eq(expandTo18Decimals(400))
      expect(reserve1).to.eq(expandTo18Decimals(200))

      expect(balance0After.sub(balance0Before)).to.eq(expandTo18Decimals(100))
      expect(balance1After.sub(balance1Before)).to.eq(expandTo18Decimals(0))
    })

    it('does swap when swap is set to true', async () => {
      const { delay, token0, token1, wallet, factory, pair, addLiquidity } = await loadFixture(delayOracleV3Fixture)

      await factory.setMintFee(token0.address, token1.address, 0, overrides)
      await factory.setSwapFee(token0.address, token1.address, 0, overrides)

      await addLiquidity(expandTo18Decimals(200), expandTo18Decimals(100))
      const depositResult = await depositAndWait(delay, token0, token1, wallet, {
        amount0: expandTo18Decimals(300),
        amount1: expandTo18Decimals(100),
        swap: true,
      })
      await addLiquidity(expandTo18Decimals(1), expandTo18Decimals(300))

      const balance0Before = await token0.balanceOf(wallet.address)
      const balance1Before = await token1.balanceOf(wallet.address)

      const tx = await delay.execute(depositResult.orderData, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))

      const balance0After = await token0.balanceOf(wallet.address)
      const balance1After = await token1.balanceOf(wallet.address)

      const [reserve0, reserve1] = await pair.getReserves()

      const expectBetween = (a: BigNumber, min: number, max: number) => {
        expect(a.gte(expandTo18Decimals(min)), 'Value too small').to.be.true
        expect(a.lte(expandTo18Decimals(max)), 'Value too large').to.be.true
      }

      expectBetween(reserve0, 500, 501)
      expectBetween(reserve1, 499, 500)
      expectBetween(balance0After.sub(balance0Before), 0, 1)
      expectBetween(balance1After.sub(balance1Before), 0, 1)
    })

    it('does not modify the order if tokens are transferred to pair', async () => {
      const { delay, token0, token1, other, pair, addLiquidity } = await loadFixture(delayOracleV3Fixture)

      await addLiquidity(expandTo18Decimals(200), expandTo18Decimals(100))
      const depositResult = await depositAndWait(delay, token0, token1, other, {
        amount0: expandTo18Decimals(2),
        amount1: expandTo18Decimals(1),
      })
      await token0.transfer(pair.address, expandTo18Decimals(2000), overrides)
      await token1.transfer(pair.address, expandTo18Decimals(1000), overrides)

      expect(await pair.balanceOf(other.address)).to.equal(0)

      const tx = await delay.execute(depositResult.orderData, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))

      const liquidity = await pair.balanceOf(other.address)
      expect(liquidity.lte(expandTo18Decimals(1))).to.be.true
    })

    it('price higher than minSwapPrice', async () => {
      const { delay, token0, token1, other, addLiquidity } = await loadFixture(getDelayForPriceOracleV3Fixture(1, 10))

      await addLiquidity(expandTo18Decimals(200), expandTo18Decimals(200))
      const depositResult = await depositAndWait(delay, token0, token1, other, {
        amount0: expandTo18Decimals(2),
        amount1: expandTo18Decimals(1),
        minSwapPrice: makeFloatEncodable(expandTo18Decimals(5)),
      })

      const tx = await delay.execute(depositResult.orderData, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
    })

    it('price lower than maxSwapPrice', async () => {
      const { delay, token0, token1, other, addLiquidity } = await loadFixture(getDelayForPriceOracleV3Fixture(1, 10))

      await addLiquidity(expandTo18Decimals(200), expandTo18Decimals(200))
      const depositResult = await depositAndWait(delay, token0, token1, other, {
        gasLimit: 720000,
        amount0: expandTo18Decimals(1),
        amount1: expandTo18Decimals(2),
        maxSwapPrice: makeFloatEncodable(expandTo18Decimals(20)),
      })

      const tx = await delay.execute(depositResult.orderData, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
    })
  })

  it('fails on price lower than minSwapPrice', async () => {
    const { delay, token0, token1, other, addLiquidity } = await loadFixture(getDelayForPriceOracleV3Fixture(1, 10))

    await addLiquidity(expandTo18Decimals(200), expandTo18Decimals(200))
    const depositResult = await depositAndWait(delay, token0, token1, other, {
      amount0: expandTo18Decimals(2),
      amount1: expandTo18Decimals(1),
      minSwapPrice: makeFloatEncodable(expandTo18Decimals(20)),
    })

    const tx = await delay.execute(depositResult.orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')

    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, false, encodeErrorData('AL15'), getGasSpent(events[0]), getEthRefund(events[0]))
  })

  it('fails on price higher than maxSwapPrice', async () => {
    const { delay, token0, token1, other, addLiquidity } = await loadFixture(getDelayForPriceOracleV3Fixture(1, 10))

    await addLiquidity(expandTo18Decimals(200), expandTo18Decimals(200))
    const depositResult = await depositAndWait(delay, token0, token1, other, {
      amount0: expandTo18Decimals(1),
      amount1: expandTo18Decimals(2),
      maxSwapPrice: makeFloatEncodable(expandTo18Decimals(5)),
    })

    const tx = await delay.execute(depositResult.orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')

    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, false, encodeErrorData('AL16'), getGasSpent(events[0]), getEthRefund(events[0]))
  })

  it('minSwapPrice is calculated correctly for 8 decimals', async () => {
    const { delay, addLiquidity, setupUniswapPool, token0, token1, wallet } = await loadFixture(
      delayWithMixedDecimalsPoolFixture
    )
    const decimals0 = await token0.decimals()
    const decimals1 = await token1.decimals()
    await setupUniswapPool(expandToDecimals('1', decimals0), expandToDecimals('0.0002', decimals1))
    await addLiquidity(parseUnits('200', decimals0), parseUnits('200', decimals1))
    const depositResult = await depositAndWait(delay, token0, token1, wallet, {
      gasLimit: 650000,
      amount0: parseUnits('2', decimals0),
      amount1: BigNumber.from(0),
      minSwapPrice: makeFloatEncodable(expandTo18Decimals('0.00018')),
    })
    const tx = await delay.execute(depositResult.orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
  })

  it('maxSwapPrice is calculated correctly for 8 decimals', async () => {
    const { delay, addLiquidity, setupUniswapPool, token0, token1, wallet } = await loadFixture(
      delayWithMixedDecimalsPoolFixture
    )
    const decimals0 = await token0.decimals()
    const decimals1 = await token1.decimals()
    await setupUniswapPool(expandToDecimals(1, decimals0), expandToDecimals(10, decimals1))
    await addLiquidity(parseUnits('200', decimals0), parseUnits('200', decimals1))
    const depositResult = await depositAndWait(delay, token0, token1, wallet, {
      gasLimit: 650000,
      amount0: BigNumber.from(0),
      amount1: parseUnits('2', decimals1),
      maxSwapPrice: makeFloatEncodable(expandTo18Decimals('10.2')),
    })
    const tx = await delay.execute(depositResult.orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
  })
})
