import { expect } from 'chai'

import { expandTo18Decimals, expandToDecimals, overrides } from '../shared/utilities'
import { pairFixture, mixedDecimalsTokenPairFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { BigNumber, constants } from 'ethers'
import { parseUnits } from '@ethersproject/units'

const WEI_SWAP_DIFFERENCE = 100

describe('TwapPair.swap', () => {
  const loadFixture = setupFixtureLoader()

  it('performs safety checkings', async () => {
    const { wallet, other, pair, addLiquidity } = await loadFixture(pairFixture)
    await addLiquidity(expandTo18Decimals(1), expandTo18Decimals(1))

    await expect(pair.connect(other).swap(0, 1, wallet.address, [])).to.be.revertedWith('TP0C')
    await expect(pair.swap(0, 1, constants.AddressZero, [])).to.be.revertedWith('TP02')
    await expect(pair.swap(0, 0, wallet.address, [])).to.be.revertedWith('TP31')
    await expect(pair.swap(1, 1, wallet.address, [])).to.be.revertedWith('TP31')
    await expect(pair.swap(constants.MaxUint256, 0, wallet.address, [])).to.be.revertedWith('TP07')
    await expect(pair.swap(0, constants.MaxUint256, wallet.address, [])).to.be.revertedWith('TP07')
  })

  describe('swapping x->y', () => {
    const swapTestCases = [
      // from uniswap
      { amount0: 1, reserve0: 5, reserve1: 10, price: 2 },
      { amount0: 1, reserve0: 10, reserve1: 5, price: 0.5 },
      { amount0: 2, reserve0: 5, reserve1: 10, price: 2 },
      { amount0: 2, reserve0: 10, reserve1: 5, price: 0.5 },
      { amount0: 1, reserve0: 10, reserve1: 10, price: 1 },
      { amount0: 1, reserve0: 100, reserve1: 100, price: 1 },
      { amount0: 1, reserve0: 1000, reserve1: 1000, price: 1 },
      // new test cases
      { amount0: 1, reserve0: 100, reserve1: 200, price: 2 },
      { amount0: 1, reserve0: 100, reserve1: 200, price: 4 },
      { amount0: 10, reserve0: 100, reserve1: 200, price: 4 },
      { amount0: 100, reserve0: 1000, reserve1: 1000, price: 0.01 },
    ]
    for (const { amount0, reserve0, reserve1, price } of swapTestCases) {
      it(`${amount0}, reserves=${reserve0}/${reserve1} price=${price}`, async () => {
        const { addLiquidity, oracle, token0, token1, pair, SWAP_FEE, PRECISION, wallet, setupUniswapPair } =
          await loadFixture(pairFixture)

        const xBefore = expandTo18Decimals(reserve0)
        const yBefore = expandTo18Decimals(reserve1)
        await addLiquidity(xBefore, yBefore)

        const { priceInfo } = await setupUniswapPair(2)

        await token0.transfer(pair.address, expandTo18Decimals(amount0), overrides)
        const swapFee = expandTo18Decimals(amount0).mul(SWAP_FEE).div(PRECISION)
        const swapAmount = expandTo18Decimals(amount0).sub(swapFee)
        const yAfter = await oracle.tradeX(
          expandTo18Decimals(reserve0).add(swapAmount),
          xBefore,
          yBefore,
          priceInfo,
          overrides
        )
        await expect(
          pair.swap(0, yBefore.sub(yAfter).add(WEI_SWAP_DIFFERENCE), wallet.address, priceInfo, overrides)
        ).to.be.revertedWith('TP2E')
        await pair.swap(0, yBefore.sub(yAfter), wallet.address, priceInfo, overrides)

        const [fee0, fee1] = await pair.getFees()
        expect(fee0).to.eq(swapFee)
        expect(fee1).to.eq(0)

        const [_reserve0, _reserve1] = await pair.getReserves()
        expect(await token0.balanceOf(pair.address)).to.eq(_reserve0.add(fee0))
        expect(await token1.balanceOf(pair.address)).to.eq(_reserve1.add(fee1))
      })
    }
  })

  describe('swapping y->x', () => {
    const swapTestCases = [
      // from uniswap
      { amount1: 1, reserve0: 5, reserve1: 10, price: 2 },
      { amount1: 1, reserve0: 10, reserve1: 5, price: 0.5 },
      { amount1: 2, reserve0: 5, reserve1: 10, price: 2 },
      { amount1: 2, reserve0: 10, reserve1: 5, price: 0.5 },
      { amount1: 1, reserve0: 10, reserve1: 10, price: 1 },
      { amount1: 1, reserve0: 100, reserve1: 100, price: 1 },
      { amount1: 1, reserve0: 1000, reserve1: 1000, price: 1 },
      // new test cases
      { amount1: 1, reserve0: 100, reserve1: 200, price: 2 },
      { amount1: 1, reserve0: 100, reserve1: 200, price: 4 },
      { amount1: 10, reserve0: 100, reserve1: 200, price: 4 },
      { amount1: 100, reserve0: 1000, reserve1: 1000, price: 100 },
    ]
    for (const { amount1, reserve0, reserve1, price } of swapTestCases) {
      it(`${amount1}, reserves=${reserve0}/${reserve1} price=${price}`, async () => {
        const { addLiquidity, oracle, token1, token0, pair, SWAP_FEE_N, wallet, setupUniswapPair } = await loadFixture(
          pairFixture
        )

        const xBefore = expandTo18Decimals(reserve0)
        const yBefore = expandTo18Decimals(reserve1)
        await addLiquidity(xBefore, yBefore)

        const { priceInfo } = await setupUniswapPair(price)

        await token1.transfer(pair.address, expandTo18Decimals(amount1), overrides)
        const xAfter = await oracle.tradeY(
          expandTo18Decimals(reserve1 + amount1 * (1 - SWAP_FEE_N)),
          xBefore,
          yBefore,
          priceInfo,
          overrides
        )
        await expect(
          pair.swap(xBefore.sub(xAfter).add(WEI_SWAP_DIFFERENCE), 0, wallet.address, priceInfo, overrides)
        ).to.be.revertedWith('TP2E')
        await pair.swap(xBefore.sub(xAfter), 0, wallet.address, priceInfo, overrides)

        const [fee0, fee1] = await pair.getFees()
        expect(fee0).to.eq(0)
        expect(fee1).to.eq(expandTo18Decimals(amount1 * SWAP_FEE_N))

        const [_reserve0, _reserve1] = await pair.getReserves()
        expect(await token0.balanceOf(pair.address)).to.eq(_reserve0.add(fee0))
        expect(await token1.balanceOf(pair.address)).to.eq(_reserve1.add(fee1))
      })
    }
  })

  it('can swap token0 for token1', async () => {
    const { addLiquidity, oracle, token0, token1, pair, SWAP_FEE_N, wallet, setupUniswapPair } = await loadFixture(
      pairFixture
    )

    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    const amount0 = expandTo18Decimals(1)
    const swapFee = expandTo18Decimals(1 * SWAP_FEE_N)
    const effectiveAmount0 = amount0.sub(swapFee)

    await addLiquidity(token0Amount, token1Amount)
    const { priceInfo } = await setupUniswapPair(2)
    const token1After = await oracle.tradeX(
      token0Amount.add(effectiveAmount0),
      token0Amount,
      token1Amount,
      priceInfo,
      overrides
    )
    const expectedOutputAmount = token1Amount.sub(token1After)
    await token0.transfer(pair.address, amount0, overrides)
    await expect(pair.swap(0, expectedOutputAmount, wallet.address, priceInfo, overrides))
      .to.emit(token1, 'Transfer')
      .withArgs(pair.address, wallet.address, expectedOutputAmount)
      .to.emit(pair, 'Swap')
      .withArgs(wallet.address, amount0, 0, 0, expectedOutputAmount, wallet.address)

    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(token0Amount.add(amount0).sub(swapFee))
    expect(reserves[1]).to.eq(token1Amount.sub(expectedOutputAmount))
    const fees = await pair.getFees()
    expect(fees[0]).to.eq(swapFee)
    expect(fees[1]).to.eq(0)
    expect(await token0.balanceOf(pair.address)).to.eq(token0Amount.add(amount0))
    expect(await token1.balanceOf(pair.address)).to.eq(token1Amount.sub(expectedOutputAmount))
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    expect(await token0.balanceOf(wallet.address)).to.eq(totalSupplyToken0.sub(token0Amount).sub(amount0))
    expect(await token1.balanceOf(wallet.address)).to.eq(totalSupplyToken1.sub(token1Amount).add(expectedOutputAmount))
  })

  it('can swap token1 for token0', async () => {
    const { addLiquidity, oracle, token0, token1, pair, SWAP_FEE_N, wallet, setupUniswapPair } = await loadFixture(
      pairFixture
    )

    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    const amount1 = expandTo18Decimals(1)
    const swapFee = expandTo18Decimals(1 * SWAP_FEE_N)
    const effectiveAmount1 = expandTo18Decimals(1).sub(swapFee)

    await addLiquidity(token0Amount, token1Amount)
    const { priceInfo } = await setupUniswapPair(2)
    const token0After = await oracle.tradeY(
      token1Amount.add(effectiveAmount1),
      token0Amount,
      token1Amount,
      priceInfo,
      overrides
    )

    const expectedOutputAmount = token0Amount.sub(token0After)
    await token1.transfer(pair.address, amount1, overrides)
    await expect(pair.swap(expectedOutputAmount, 0, wallet.address, priceInfo, overrides))
      .to.emit(token0, 'Transfer')
      .withArgs(pair.address, wallet.address, expectedOutputAmount)
      .to.emit(pair, 'Swap')
      .withArgs(wallet.address, 0, amount1, expectedOutputAmount, 0, wallet.address)

    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(token0Amount.sub(expectedOutputAmount))
    expect(reserves[1]).to.eq(token1Amount.add(amount1).sub(swapFee))
    const fees = await pair.getFees()
    expect(fees[0]).to.eq(0)
    expect(fees[1]).to.eq(swapFee)
    expect(await token0.balanceOf(pair.address)).to.eq(token0Amount.sub(expectedOutputAmount))
    expect(await token1.balanceOf(pair.address)).to.eq(token1Amount.add(amount1))
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    expect(await token0.balanceOf(wallet.address)).to.eq(totalSupplyToken0.sub(token0Amount).add(expectedOutputAmount))
    expect(await token1.balanceOf(wallet.address)).to.eq(totalSupplyToken1.sub(token1Amount).sub(amount1))
  })

  it('correctly updates fees when less token1 is withdrawn', async () => {
    const { addLiquidity, oracle, token0, pair, SWAP_FEE_N, wallet, setupUniswapPair } = await loadFixture(pairFixture)

    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    const amount0 = expandTo18Decimals(1)
    const fee = expandTo18Decimals(1 * SWAP_FEE_N)
    const effectiveAmount0 = amount0.sub(fee)

    await addLiquidity(token0Amount, token1Amount)
    const { priceInfo } = await setupUniswapPair(2)
    const token1After = await oracle.tradeX(
      token0Amount.add(effectiveAmount0),
      token0Amount,
      token1Amount,
      priceInfo,
      overrides
    )

    const leftInContract = expandTo18Decimals(0.02)

    const expectedOutputAmount = token1Amount.sub(token1After).sub(leftInContract)
    await token0.transfer(pair.address, amount0, overrides)

    const feesBefore = await pair.getFees()
    await pair.swap(0, expectedOutputAmount, wallet.address, priceInfo, overrides)
    const feesAfter = await pair.getFees()

    expect(feesAfter[0].sub(feesBefore[0])).to.eq(fee)
    expect(feesAfter[1].sub(feesBefore[1])).to.eq(leftInContract)
  })

  it('correctly updates fees when less token0 is withdrawn', async () => {
    const { addLiquidity, oracle, token1, pair, SWAP_FEE_N, wallet, setupUniswapPair } = await loadFixture(pairFixture)

    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    const amount1 = expandTo18Decimals(1)
    const fee = expandTo18Decimals(1 * SWAP_FEE_N)
    const effectiveAmount1 = amount1.sub(fee)

    await addLiquidity(token0Amount, token1Amount)
    const { priceInfo } = await setupUniswapPair(2)

    const token0After = await oracle.tradeY(
      token1Amount.add(effectiveAmount1),
      token0Amount,
      token1Amount,
      priceInfo,
      overrides
    )

    const leftInContract = expandTo18Decimals(0.02)

    const expectedOutputAmount = token0Amount.sub(token0After).sub(leftInContract)
    await token1.transfer(pair.address, amount1, overrides)

    const feesBefore = await pair.getFees()
    await pair.swap(expectedOutputAmount, 0, wallet.address, priceInfo, overrides)
    const feesAfter = await pair.getFees()

    expect(feesAfter[0].sub(feesBefore[0])).to.eq(leftInContract)
    expect(feesAfter[1].sub(feesBefore[1])).to.eq(fee)
  })

  it('cannot set reserves to zero', async () => {
    const { addLiquidity, token0, pair, wallet, setupUniswapPair } = await loadFixture(pairFixture)
    await addLiquidity(BigNumber.from(1_000_000), BigNumber.from(1_000_000))

    const { priceInfo } = await setupUniswapPair(1)

    await token0.transfer(pair.address, 1_003_009)
    await expect(pair.swap(0, 997_000, wallet.address, priceInfo)).to.be.revertedWith('RS09')
  })

  it('swap 8-decimals and 18-decimals tokens', async () => {
    const { addLiquidity, oracle, token0, token1, pair, SWAP_FEE_N, wallet, setupUniswapPair } = await loadFixture(
      mixedDecimalsTokenPairFixture
    )

    const decimals0 = await token0.decimals()
    const decimals1 = await token1.decimals()
    const token0Amount = expandToDecimals(5, decimals0)
    const token1Amount = expandToDecimals(10, decimals1)
    const amount0 = expandToDecimals(1, decimals0)
    const swapFee = expandToDecimals(SWAP_FEE_N, decimals0)
    const effectiveAmount0 = amount0.sub(swapFee)

    const price = 2
    const { priceInfo } = await setupUniswapPair(price)
    const token0UniswapSupply = expandToDecimals(1, decimals0)
    const token1UniswapSupply = expandToDecimals(price, decimals1)

    await addLiquidity(token0Amount, token1Amount)

    const token1After = await oracle.tradeX(
      token0Amount.add(effectiveAmount0),
      token0Amount,
      token1Amount,
      priceInfo,
      overrides
    )

    const expectedOutputAmount = token1Amount.sub(token1After)
    await token0.transfer(pair.address, amount0, overrides)
    await expect(pair.swap(0, expectedOutputAmount, wallet.address, priceInfo, overrides))
      .to.emit(token1, 'Transfer')
      .withArgs(pair.address, wallet.address, expectedOutputAmount)
      .to.emit(pair, 'Swap')
      .withArgs(wallet.address, amount0, 0, 0, expectedOutputAmount, wallet.address)

    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(token0Amount.add(amount0).sub(swapFee))
    expect(reserves[1]).to.eq(token1Amount.sub(expectedOutputAmount))
    const fees = await pair.getFees()
    expect(fees[0]).to.eq(swapFee)
    expect(fees[1]).to.eq(0)
    expect(await token0.balanceOf(pair.address)).to.eq(token0Amount.add(amount0))
    expect(await token1.balanceOf(pair.address)).to.eq(token1Amount.sub(expectedOutputAmount))
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    expect(await token0.balanceOf(wallet.address)).to.eq(
      totalSupplyToken0.sub(token0UniswapSupply).sub(token0Amount).sub(amount0)
    )
    expect(await token1.balanceOf(wallet.address)).to.eq(
      totalSupplyToken1.sub(token1UniswapSupply).sub(token1Amount).add(expectedOutputAmount)
    )
  })

  it('swap 8-decimals and 18-decimals tokens (reversed)', async () => {
    const { addLiquidity, oracle, token0, token1, pair, SWAP_FEE_N, wallet, setupUniswapPair } = await loadFixture(
      mixedDecimalsTokenPairFixture
    )

    const decimals0 = await token0.decimals()
    const decimals1 = await token1.decimals()
    const token0Amount = expandToDecimals(5, decimals0)
    const token1Amount = expandToDecimals(10, decimals1)
    const amount1 = expandToDecimals(1, decimals1)
    const swapFee = expandToDecimals(SWAP_FEE_N, decimals1)
    const effectiveAmount1 = amount1.sub(swapFee)

    const price = 2
    const { priceInfo } = await setupUniswapPair(price)
    const token0UniswapSupply = expandToDecimals(1, decimals0)
    const token1UniswapSupply = expandToDecimals(price, decimals1)

    await addLiquidity(token0Amount, token1Amount)
    const token0After = await oracle.tradeY(
      token1Amount.add(effectiveAmount1),
      token0Amount,
      token1Amount,
      priceInfo,
      overrides
    )

    const expectedOutputAmount = token0Amount.sub(token0After)
    await token1.transfer(pair.address, amount1, overrides)
    await expect(pair.swap(expectedOutputAmount, 0, wallet.address, priceInfo, overrides))
      .to.emit(token0, 'Transfer')
      .withArgs(pair.address, wallet.address, expectedOutputAmount)
      .to.emit(pair, 'Swap')
      .withArgs(wallet.address, 0, amount1, expectedOutputAmount, 0, wallet.address)

    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(token0Amount.sub(expectedOutputAmount))
    expect(reserves[1]).to.eq(token1Amount.add(amount1.sub(swapFee)))
    const fees = await pair.getFees()
    expect(fees[0]).to.eq(0)
    expect(fees[1]).to.eq(swapFee)
    expect(await token0.balanceOf(pair.address)).to.eq(token0Amount.sub(expectedOutputAmount))
    expect(await token1.balanceOf(pair.address)).to.eq(token1Amount.add(amount1))
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    expect(await token0.balanceOf(wallet.address)).to.eq(
      totalSupplyToken0.sub(token0UniswapSupply).sub(token0Amount).add(expectedOutputAmount)
    )
    expect(await token1.balanceOf(wallet.address)).to.eq(
      totalSupplyToken1.sub(token1UniswapSupply).sub(token1Amount).sub(amount1)
    )
  })

  it('token0 liquidity cannot be drained to zero', async () => {
    const { pair, token1, addLiquidity, wallet, setupUniswapPair } = await loadFixture(pairFixture)

    await addLiquidity(expandTo18Decimals(500), expandTo18Decimals(1000))

    const { priceInfo } = await setupUniswapPair(2)

    const swapOutput = expandTo18Decimals(500)
    const swapInput = await pair.getSwapAmount1In(swapOutput, priceInfo)
    await token1.transfer(pair.address, swapInput, overrides)
    await expect(pair.swap(swapOutput, 0, wallet.address, priceInfo, overrides)).to.be.revertedWith('TP07')
  })

  it('token1 liquidity cannot be drained to zero', async () => {
    const { pair, token0, addLiquidity, wallet, setupUniswapPair } = await loadFixture(pairFixture)

    await addLiquidity(expandTo18Decimals(1000), expandTo18Decimals(500))

    const { priceInfo } = await setupUniswapPair(2)

    const swapOutput = expandTo18Decimals(500)
    const swapInput = await pair.getSwapAmount0In(swapOutput, priceInfo)
    await token0.transfer(pair.address, swapInput, overrides)
    await expect(pair.swap(0, swapOutput, wallet.address, priceInfo, overrides)).to.be.revertedWith('TP07')
  })

  it('reverts if to is zero', async () => {
    const { pair, oracle, setupUniswapPair } = await loadFixture(pairFixture)
    await setupUniswapPair(1)
    const { priceInfo } = await oracle.testEncodePriceInfo(0, 0, overrides)
    await expect(
      pair.swap(expandTo18Decimals(1), expandTo18Decimals(2), constants.AddressZero, priceInfo)
    ).to.revertedWith('TP02')
  })

  it('checks weth-dai specific price issue', async () => {
    const { pair, token0, token1, factory, addLiquidity, wallet, other, setupUniswapPair } = await loadFixture(
      pairFixture
    )

    // token0: DAI, token1: WETH

    const reserve0 = BigNumber.from('44547107558096886868242274')
    const reserve1 = BigNumber.from('27685936267870034790868')

    const amount0Out = parseUnits('1000')
    const amount1Out = '0'

    const { priceInfo } = await setupUniswapPair('0.000545609375715524')

    await addLiquidity(reserve0, reserve1)

    const amountIn = await pair.getSwapAmount1In(amount0Out, priceInfo)
    await token1.transfer(pair.address, amountIn, overrides)
    await factory.setTrader(token0.address, token1.address, other.address, overrides)
    await expect(pair.connect(other).swap(amount0Out, amount1Out, wallet.address, priceInfo, overrides))
      .to.emit(pair, 'Swap')
      .withArgs(other.address, 0, amountIn, amount0Out, 0, wallet.address)
  })
})
