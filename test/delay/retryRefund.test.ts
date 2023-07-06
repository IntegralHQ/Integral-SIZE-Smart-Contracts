import { expect } from 'chai'
import { delayFixture } from '../shared/fixtures'
import { delayFailingFixture } from '../shared/fixtures/delayFailingFixture'
import { depositAndWait } from '../shared/orders'
import { setupFixtureLoader } from '../shared/setup'
import { encodeErrorData } from '../shared/solidityError'
import { expandTo18Decimals, getEthRefund, getEvents, getGasSpent, overrides } from '../shared/utilities'

describe('TwapDelay.retryRefund', () => {
  const loadFixture = setupFixtureLoader()

  it('reverts for unfailed orders', async () => {
    const { delay, token0, token1, addLiquidity, other } = await loadFixture(delayFixture)
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await token0.transfer(other.address, expandTo18Decimals(10), overrides)
    await token1.transfer(other.address, expandTo18Decimals(10), overrides)

    const result = await depositAndWait(delay.connect(other), token0.connect(other), token1.connect(other), other)
    const tx = await delay.execute(result.orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))

    await expect(delay.retryRefund(result.orderData[0], overrides)).to.revertedWith('OS71')
  })

  it('reverts for enqueued orders', async () => {
    const { delay, token0, token1, addLiquidity, other } = await loadFixture(delayFixture)
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await token0.transfer(other.address, expandTo18Decimals(10), overrides)
    await token1.transfer(other.address, expandTo18Decimals(10), overrides)

    const result = await depositAndWait(delay.connect(other), token0.connect(other), token1.connect(other), other)
    await expect(delay.retryRefund(result.orderData[0], overrides)).to.revertedWith('TD21')
  })

  it('reverts on unsuccessful retry refunds', async () => {
    const { delay, token0, token1, addLiquidity, other } = await loadFixture(delayFailingFixture)
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await token0.transfer(other.address, expandTo18Decimals(10), overrides)
    await token1.transfer(other.address, expandTo18Decimals(10), overrides)

    const deposit = await depositAndWait(delay.connect(other), token0.connect(other), token1.connect(other), other)

    await token0.setWasteTransferGas(true, overrides)
    await delay.execute(deposit.orderData, overrides)

    await expect(delay.retryRefund(deposit.orderData[0], overrides)).to.revertedWith('TD14')
  })

  it('refunds tokens', async () => {
    const { delay, token0, token1, addLiquidity, other } = await loadFixture(delayFailingFixture)
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await token0.transfer(other.address, expandTo18Decimals(10), overrides)
    await token1.transfer(other.address, expandTo18Decimals(10), overrides)

    const token0InitialBalance = await token0.balanceOf(other.address)
    const token1InitialBalance = await token1.balanceOf(other.address)
    const deposit = await depositAndWait(delay.connect(other), token0.connect(other), token1.connect(other), other)

    await token0.setWasteTransferGas(true, overrides)
    const tx = await delay.execute(deposit.orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, false, encodeErrorData('TH05'), getGasSpent(events[0]), getEthRefund(events[0]))
      .to.emit(delay, 'RefundFailed')
      .withArgs(deposit.to, token0.address, deposit.amount0, encodeErrorData('TH05'))
      .to.emit(delay, 'RefundFailed')
      .withArgs(deposit.to, token1.address, deposit.amount1, encodeErrorData('TH05'))
    expect(await token0.balanceOf(other.address)).to.lt(token0InitialBalance)

    await token0.setWasteTransferGas(false, overrides)

    await delay.retryRefund(deposit.orderData[0], overrides)

    expect(await token0.balanceOf(other.address)).to.deep.eq(token0InitialBalance)
    expect(await token1.balanceOf(other.address)).to.deep.eq(token1InitialBalance)
  })
})
