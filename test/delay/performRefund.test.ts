import { expect } from 'chai'
import { BigNumber, utils } from 'ethers'
import { delayFailingFixture } from '../shared/fixtures/delayFailingFixture'
import { buyAndWait, depositAndWait, sellAndWait } from '../shared/orders'
import { setupFixtureLoader } from '../shared/setup'
import { encodeErrorData } from '../shared/solidityError'
import { expandTo18Decimals, getEthRefund, getEvents, getGasSpent, mineBlock, overrides } from '../shared/utilities'

describe('TwapDelay.performRefund', () => {
  const loadFixture = setupFixtureLoader()
  const YEAR = 365 * 24 * 60 * 60

  it('ignores empty order type', async () => {
    const { delay, token0, token1, addLiquidity, other, emptyOrder } = await loadFixture(delayFailingFixture)
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await token0.transfer(other.address, expandTo18Decimals(10), overrides)
    await token1.transfer(other.address, expandTo18Decimals(10), overrides)

    const deposit = await depositAndWait(delay.connect(other), token0.connect(other), token1.connect(other), other)
    const lastProcessedOrderIdBefore = await delay.lastProcessedOrderId()
    const orderHashBefore = await delay.getOrderHash(deposit.orderData[0].orderId, overrides)

    const invalidOrder = { ...emptyOrder, orderId: 1 }

    await expect(delay.testPerformRefund(invalidOrder, false, overrides)).not.to.be.reverted

    expect(await delay.lastProcessedOrderId()).to.equal(lastProcessedOrderIdBefore)
    expect(await delay.getOrderHash(deposit.orderData[0].orderId, overrides)).to.equal(orderHashBefore)
  })

  it('ignores invalid order type', async () => {
    const { delay, token0, token1, addLiquidity, other, emptyOrder } = await loadFixture(delayFailingFixture)
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await token0.transfer(other.address, expandTo18Decimals(10), overrides)
    await token1.transfer(other.address, expandTo18Decimals(10), overrides)

    const deposit = await depositAndWait(delay.connect(other), token0.connect(other), token1.connect(other), other)
    const lastProcessedOrderIdBefore = await delay.lastProcessedOrderId()
    const orderHashBefore = await delay.getOrderHash(deposit.orderData[0].orderId, overrides)

    const invalidOrder = { ...emptyOrder, orderId: 1, orderType: 7 }

    await expect(delay.testPerformRefund(invalidOrder, false, overrides)).not.to.be.reverted

    expect(await delay.lastProcessedOrderId()).to.equal(lastProcessedOrderIdBefore)
    expect(await delay.getOrderHash(deposit.orderData[0].orderId, overrides)).to.equal(orderHashBefore)
  })

  it('deletes order after completed refund', async () => {
    const { delay, token0, token1, addLiquidity, other } = await loadFixture(delayFailingFixture)
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await token0.transfer(other.address, expandTo18Decimals(10), overrides)
    await token1.transfer(other.address, expandTo18Decimals(10), overrides)

    const deposit = await depositAndWait(delay.connect(other), token0.connect(other), token1.connect(other), other)

    await token0.setWasteTransferGas(true)
    const tx = await delay.execute(deposit.orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, false, encodeErrorData('TH05'), getGasSpent(events[0]), getEthRefund(events[0]))
      .to.emit(delay, 'RefundFailed')
      .withArgs(deposit.to, token0.address, deposit.amount0, encodeErrorData('TH05'))
      .to.emit(delay, 'RefundFailed')
      .withArgs(deposit.to, token1.address, deposit.amount1, encodeErrorData('TH05'))

    await token0.setWasteTransferGas(false)
    await delay.testPerformRefund(deposit.orderData[0], false, overrides)

    const orderHashOnChain = await delay.getOrderHash(deposit.orderData[0].orderId, overrides)
    expect(orderHashOnChain).to.be.eq(utils.hexZeroPad(BigNumber.from(0).toHexString(), 32))
  })

  describe('deposit', () => {
    it('before 1 year', async () => {
      const { delay, token0, token1, addLiquidity, other } = await loadFixture(delayFailingFixture)
      await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
      await token0.transfer(other.address, expandTo18Decimals(10), overrides)
      await token1.transfer(other.address, expandTo18Decimals(10), overrides)

      const token0InitialBalance = await token0.balanceOf(other.address)
      const token1InitialBalance = await token1.balanceOf(other.address)
      const result = await depositAndWait(delay.connect(other), token0.connect(other), token1.connect(other), other)

      await token0.setWasteTransferGas(true, overrides)
      expect(await token0.balanceOf(other.address)).to.lt(token0InitialBalance)

      await expect(delay.testPerformRefund(result.orderData[0], false, overrides)).to.be.revertedWith('TD14')

      await token0.setWasteTransferGas(false, overrides)
      await delay.testPerformRefund(result.orderData[0], false, overrides)

      expect(await token0.balanceOf(other.address)).to.deep.eq(token0InitialBalance)
      expect(await token1.balanceOf(other.address)).to.deep.eq(token1InitialBalance)
    })

    it('after 1 year', async () => {
      const { delay, token0, token1, wallet, addLiquidity, other } = await loadFixture(delayFailingFixture)
      await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
      await token0.transfer(other.address, expandTo18Decimals(10), overrides)
      await token1.transfer(other.address, expandTo18Decimals(10), overrides)

      const initialToken0OwnerBalance = await token0.balanceOf(wallet.address)
      const initialToken1OwnerBalance = await token1.balanceOf(wallet.address)
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

      await token0.setWasteTransferGas(false, overrides)
      await (delay.provider as any).send('evm_increaseTime', [YEAR])
      await mineBlock(wallet)
      await delay.testPerformRefund(deposit.orderData[0], false, overrides)

      const orderHashOnChain = await delay.getOrderHash(deposit.orderData[0].orderId, overrides)

      expect(orderHashOnChain).to.be.eq(utils.hexZeroPad(BigNumber.from(0).toHexString(), 32))
      expect(await token0.balanceOf(wallet.address)).to.deep.eq(initialToken0OwnerBalance.add(deposit.amount0))
      expect(await token1.balanceOf(wallet.address)).to.deep.eq(initialToken1OwnerBalance.add(deposit.amount1))
    })

    it('refunds ether', async () => {
      const { delay, token0, token1, addLiquidity, other, wallet } = await loadFixture(delayFailingFixture)
      await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
      await token0.transfer(other.address, expandTo18Decimals(10))
      await token1.transfer(other.address, expandTo18Decimals(10))

      const balanceBefore = await other.getBalance()
      const result = await depositAndWait(delay, token0, token1, other)

      await delay.connect(wallet).testPerformRefund(result.orderData[0], true, overrides)
      expect((await other.getBalance()).gt(balanceBefore)).to.be.true
    })
  })

  describe('buy', () => {
    it('before 1 year', async () => {
      const { delay, token0, token1, addLiquidity, other } = await loadFixture(delayFailingFixture)
      await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
      await token0.transfer(other.address, expandTo18Decimals(10), overrides)
      await token1.transfer(other.address, expandTo18Decimals(10), overrides)

      const token0InitialBalance = await token0.balanceOf(other.address)
      const buy = await buyAndWait(delay.connect(other), token0.connect(other), token1.connect(other), other, {
        gasLimit: 200000,
      })

      await token0.setWasteTransferGas(true, overrides)
      const tx = await delay.execute(buy.orderData, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
        .to.emit(delay, 'RefundFailed')
        .withArgs(buy.to, token0.address, buy.amountInMax, encodeErrorData('TH05'))
      expect(await token0.balanceOf(other.address)).to.lt(token0InitialBalance)

      await expect(delay.testPerformRefund(buy.orderData[0], false, overrides)).to.be.revertedWith('TD14')

      await token0.setWasteTransferGas(false, overrides)
      await delay.testPerformRefund(buy.orderData[0], false, overrides)

      expect(await token0.balanceOf(other.address)).to.deep.eq(token0InitialBalance)
    })

    it('after 1 year', async () => {
      const { delay, token0, token1, wallet, addLiquidity, other } = await loadFixture(delayFailingFixture)
      await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
      await token0.transfer(other.address, expandTo18Decimals(10), overrides)
      await token1.transfer(other.address, expandTo18Decimals(10), overrides)

      const initialToken0OwnerBalance = await token0.balanceOf(wallet.address)
      const buy = await buyAndWait(delay.connect(other), token0.connect(other), token1.connect(other), other, {
        gasLimit: 200000,
      })

      await token0.setWasteTransferGas(true, overrides)
      const tx = await delay.execute(buy.orderData, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
        .to.emit(delay, 'RefundFailed')
        .withArgs(buy.to, token0.address, buy.amountInMax, encodeErrorData('TH05'))

      await token0.setWasteTransferGas(false, overrides)
      await (delay.provider as any).send('evm_increaseTime', [YEAR])
      await mineBlock(wallet)
      await delay.testPerformRefund(buy.orderData[0], false, overrides)

      const orderHashOnChain = await delay.getOrderHash(buy.orderData[0].orderId, overrides)

      expect(orderHashOnChain).to.be.eq(utils.hexZeroPad(BigNumber.from(0).toHexString(), 32))
      expect(await token0.balanceOf(wallet.address)).to.deep.eq(initialToken0OwnerBalance.add(buy.amountInMax))
    })

    it('refunds ether', async () => {
      const { delay, token0, token1, addLiquidity, other, wallet } = await loadFixture(delayFailingFixture)
      await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
      await token0.transfer(other.address, expandTo18Decimals(10), overrides)
      await token1.transfer(other.address, expandTo18Decimals(10), overrides)

      const balanceBefore = await other.getBalance()
      const result = await buyAndWait(delay, token0, token1, other)

      await delay.connect(wallet).testPerformRefund(result.orderData[0], true, overrides)
      expect((await other.getBalance()).gt(balanceBefore)).to.be.true
    })
  })

  describe('sell', () => {
    it('before 1 year', async () => {
      const { delay, token0, token1, addLiquidity, other } = await loadFixture(delayFailingFixture)
      await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
      await token0.transfer(other.address, expandTo18Decimals(10), overrides)
      await token1.transfer(other.address, expandTo18Decimals(10), overrides)

      const token0InitialBalance = await token0.balanceOf(other.address)
      const sell = await sellAndWait(delay.connect(other), token0.connect(other), token1.connect(other), other)

      await token0.setWasteTransferGas(true, overrides)
      const tx = await delay.execute(sell.orderData, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TH05'), getGasSpent(events[0]), getEthRefund(events[0]))
        .to.emit(delay, 'RefundFailed')
        .withArgs(sell.to, token0.address, sell.amountIn, encodeErrorData('TH05'))
      expect(await token0.balanceOf(other.address)).to.lt(token0InitialBalance)

      await expect(delay.testPerformRefund(sell.orderData[0], false, overrides)).to.be.revertedWith('TD14')

      await token0.setWasteTransferGas(false, overrides)
      await delay.testPerformRefund(sell.orderData[0], false, overrides)

      expect(await token0.balanceOf(other.address)).to.deep.eq(token0InitialBalance)
    })

    it('after 1 year', async () => {
      const { delay, token0, token1, wallet, addLiquidity, other } = await loadFixture(delayFailingFixture)
      await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
      await token0.transfer(other.address, expandTo18Decimals(10), overrides)
      await token1.transfer(other.address, expandTo18Decimals(10), overrides)

      const initialToken0OwnerBalance = await token0.balanceOf(wallet.address)
      const sell = await sellAndWait(delay.connect(other), token0.connect(other), token1.connect(other), other)

      await token0.setWasteTransferGas(true, overrides)
      const tx = await delay.execute(sell.orderData, overrides)
      const events = await getEvents(tx, 'OrderExecuted')
      await expect(Promise.resolve(tx))
        .to.emit(delay, 'OrderExecuted')
        .withArgs(1, false, encodeErrorData('TH05'), getGasSpent(events[0]), getEthRefund(events[0]))
        .to.emit(delay, 'RefundFailed')
        .withArgs(sell.to, token0.address, sell.amountIn, encodeErrorData('TH05'))

      await token0.setWasteTransferGas(false, overrides)
      await (delay.provider as any).send('evm_increaseTime', [YEAR])
      await mineBlock(wallet)
      await delay.testPerformRefund(sell.orderData[0], false, overrides)

      const orderHashOnChain = await delay.getOrderHash(sell.orderData[0].orderId, overrides)

      expect(orderHashOnChain).to.be.eq(utils.hexZeroPad(BigNumber.from(0).toHexString(), 32))
      expect(await token0.balanceOf(wallet.address)).to.deep.eq(initialToken0OwnerBalance.add(sell.amountIn))
    })

    it('refunds ether', async () => {
      const { delay, token0, token1, addLiquidity, other, wallet } = await loadFixture(delayFailingFixture)
      await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
      await token0.transfer(other.address, expandTo18Decimals(10))
      await token1.transfer(other.address, expandTo18Decimals(10))

      const balanceBefore = await other.getBalance()
      const result = await sellAndWait(delay, token0, token1, other)

      await delay.connect(wallet).testPerformRefund(result.orderData[0], true, overrides)
      expect((await other.getBalance()).gt(balanceBefore)).to.be.true
    })
  })
})
