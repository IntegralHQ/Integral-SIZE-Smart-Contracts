import { expect } from 'chai'
import { constants, BigNumber, utils } from 'ethers'
import { delayFixture } from '../shared/fixtures'
import { getDefaultWithdraw, withdrawAndWait } from '../shared/orders'
import { OrderType } from '../shared/OrderType'
import { setupFixtureLoader } from '../shared/setup'
import { expandTo18Decimals, overrides, pairAddressToPairId } from '../shared/utilities'

describe('TwapDelay.withdraw', () => {
  const loadFixture = setupFixtureLoader()

  describe('checks', () => {
    it('fails if the deadline is exceeded', async () => {
      const { delay, token0, token1, wallet, provider } = await loadFixture(delayFixture)
      const withdrawRequest = getDefaultWithdraw(token0, token1, wallet)
      withdrawRequest.submitDeadline = await provider.getBlockNumber()

      await expect(delay.withdraw(withdrawRequest, overrides)).to.revertedWith('OS04')
    })

    it('reverts when both min token amounts are zero', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const withdrawRequest = getDefaultWithdraw(token0, token1, wallet)
      withdrawRequest.liquidity = BigNumber.from(0)

      await expect(delay.withdraw(withdrawRequest, overrides)).to.revertedWith('OS22')
    })

    it('reverts when address to is not set', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const withdrawRequest = getDefaultWithdraw(token0, token1, wallet)
      withdrawRequest.to = constants.AddressZero

      await expect(delay.withdraw(withdrawRequest, overrides)).to.revertedWith('OS26')
    })

    it('reverts when gasLimit is lower than minimum', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const withdrawRequest = getDefaultWithdraw(token0, token1, wallet)
      withdrawRequest.gasLimit = 999

      await expect(delay.withdraw(withdrawRequest, overrides)).to.revertedWith('OS3D')
    })

    it('reverts when gasLimit is higher than maximum', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const withdrawRequest = getDefaultWithdraw(token0, token1, wallet)
      withdrawRequest.gasLimit = 160001

      await delay.setMaxGasLimit(160000, overrides)
      await expect(delay.withdraw(withdrawRequest, overrides)).to.revertedWith('OS3E')
    })

    it('reverts when pair does not exist', async () => {
      const { delay, token0, token, wallet } = await loadFixture(delayFixture)
      const withdrawRequest = getDefaultWithdraw(token, token0, wallet)

      await expect(delay.withdraw(withdrawRequest, overrides)).to.revertedWith('OS17')
    })

    it('reverts when no ether was sent', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const withdrawRequest = getDefaultWithdraw(token0, token1, wallet)

      await delay.setGasPrice(100, overrides)
      await expect(delay.withdraw(withdrawRequest, overrides)).to.revertedWith('OS1E')
    })

    it('reverts when not enough ether was sent', async () => {
      const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
      const withdrawRequest = getDefaultWithdraw(token0, token1, wallet)

      const gasPrice = 100
      await delay.setGasPrice(gasPrice, overrides)
      await expect(
        delay.withdraw(withdrawRequest, {
          ...overrides,
          value: withdrawRequest.gasLimit * gasPrice - 1,
        })
      ).to.revertedWith('OS1E')
    })

    it('reverts when withdraw is disabled', async () => {
      const { delay, token0, token1, wallet, pair } = await loadFixture(delayFixture)
      await delay.setOrderDisabled(pair.address, OrderType.Withdraw, true, overrides)
      const withdrawRequest = getDefaultWithdraw(token0, token1, wallet)
      await expect(delay.withdraw(withdrawRequest, overrides)).to.revertedWith('OS0A')

      await delay.setOrderDisabled(pair.address, OrderType.Withdraw, false)
      await expect(delay.withdraw(withdrawRequest, overrides)).to.revertedWith('OS1E')
    })
  })

  it('refunds excess value', async () => {
    const { delay, pair, token0, token1, addLiquidity, wallet } = await loadFixture(delayFixture)

    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    const gasPrice = utils.parseUnits('69.420', 'gwei')
    const excess = 12345
    await delay.setGasPrice(gasPrice, overrides)

    const withdrawRequest = getDefaultWithdraw(token0, token1, wallet)
    const value = gasPrice.mul(withdrawRequest.gasLimit)

    await pair.approve(delay.address, constants.MaxUint256, overrides)

    const balanceBefore = await wallet.getBalance()
    const delayBalanceBefore = await wallet.provider.getBalance(delay.address)

    const tx = await delay.withdraw(withdrawRequest, {
      ...overrides,
      value: value.add(excess),
    })

    const { gasUsed, effectiveGasPrice } = await tx.wait()

    const balanceAfter = await wallet.getBalance()
    const delayBalanceAfter = await wallet.provider.getBalance(delay.address)

    expect(balanceBefore.sub(balanceAfter).sub(gasUsed.mul(effectiveGasPrice))).to.equal(value)
    expect(delayBalanceAfter.sub(delayBalanceBefore)).to.eq(value)
  })

  it('deposits liquidity', async () => {
    const { delay, pair, token0, token1, addLiquidity, wallet } = await loadFixture(delayFixture)

    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))

    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const withdrawRequest = getDefaultWithdraw(token0, token1, wallet)

    const liquidityBefore = await pair.balanceOf(wallet.address)
    const delayLiquidityBefore = await pair.balanceOf(delay.address)

    await pair.approve(delay.address, constants.MaxUint256, overrides)

    await delay.withdraw(withdrawRequest, {
      ...overrides,
      value: gasPrice.mul(withdrawRequest.gasLimit),
    })

    const liquidityAfter = await pair.balanceOf(wallet.address)
    const delayLiquidityAfter = await pair.balanceOf(delay.address)

    expect(liquidityBefore.sub(liquidityAfter)).to.equal(withdrawRequest.liquidity)
    expect(delayLiquidityAfter.sub(delayLiquidityBefore)).to.eq(withdrawRequest.liquidity)
  })

  it('enqueues an order', async () => {
    const { delay, token0, token1, addLiquidity, wallet, pair } = await loadFixture(delayFixture)

    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    const gasPrice = utils.parseUnits('69.420', 'gwei')
    await delay.setGasPrice(gasPrice, overrides)

    const withdrawRequest = getDefaultWithdraw(token0, token1, wallet)

    await pair.approve(delay.address, constants.MaxUint256, overrides)

    const tx = await delay.withdraw(withdrawRequest, {
      ...overrides,
      value: gasPrice.mul(withdrawRequest.gasLimit),
    })
    const { timestamp } = await wallet.provider.getBlock((await tx.wait()).blockHash)

    const newestOrderId = await delay.newestOrderId()
    const { orderType, validAfterTimestamp } = await delay.getOrder(newestOrderId)
    const result = await delay.getWithdrawOrder(newestOrderId)

    expect(orderType).to.equal(OrderType.Withdraw)
    expect(validAfterTimestamp).to.equal((await delay.delay()) + timestamp)

    expect([...result]).to.deep.equal([
      pairAddressToPairId(pair.address),
      withdrawRequest.liquidity,
      withdrawRequest.amount0Min,
      withdrawRequest.amount1Min,
      withdrawRequest.unwrap,
      wallet.address,
      BigNumber.from(gasPrice),
      BigNumber.from(withdrawRequest.gasLimit),
      validAfterTimestamp,
    ])
  })

  it('enqueues an order with reverse tokens', async () => {
    const { delay, token0, token1, wallet, pair, addLiquidity } = await loadFixture(delayFixture)

    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    const withdrawRequest = await withdrawAndWait(delay, pair, token1, token0, wallet)
    const result = await delay.getWithdrawOrder(await delay.newestOrderId())

    expect([...result]).to.deep.equal([
      pairAddressToPairId(pair.address),
      withdrawRequest.liquidity,
      // because we swapped before this is actually 0 and 1, not 1 and 0
      withdrawRequest.amount1Min,
      withdrawRequest.amount0Min,
      withdrawRequest.unwrap,
      wallet.address,
      BigNumber.from(withdrawRequest.gasPrice),
      BigNumber.from(withdrawRequest.gasLimit),
      result.validAfterTimestamp,
    ])
  })

  it('returns orderId', async () => {
    const { delay, orderIdTest, token0, token1, wallet, pair, addLiquidity } = await loadFixture(delayFixture)
    const gasPrice = await delay.gasPrice()
    const withdrawRequest = getDefaultWithdraw(token0, token1, wallet)

    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await pair.transfer(orderIdTest.address, utils.parseEther('1'), overrides)
    await orderIdTest.approve(pair.address, delay.address, constants.MaxUint256, overrides)

    await expect(
      orderIdTest.withdraw(withdrawRequest, {
        ...overrides,
        value: gasPrice.mul(withdrawRequest.gasLimit),
      })
    )
      .to.emit(orderIdTest, 'OrderId')
      .withArgs(1)
  })
})
