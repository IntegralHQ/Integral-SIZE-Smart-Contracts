import { expect } from 'chai'
import { BigNumber, utils } from 'ethers'
import { parseUnits } from 'ethers/lib/utils'
import { OrdersTest } from '../build/types'
import { ordersFixture } from './shared/fixtures'
import { OrderType } from './shared/OrderType'
import { setupFixtureLoader } from './shared/setup'
import { overrides } from './shared/utilities'

describe('Orders', () => {
  const TEST_PAIR_ID = 1234
  const TEST_ADDRESS = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'

  const loadFixture = setupFixtureLoader()
  let orders: OrdersTest

  before(async () => {
    ;({ orders } = await loadFixture(ordersFixture))
  })

  it('enqueueDepositOrder', async () => {
    const gasPrice = utils.parseUnits('123.456', 'gwei')
    const validAfterTimestamp = Math.floor(Date.now() / 1000)
    const depositOrder = [
      TEST_PAIR_ID, // pairId
      parseUnits('1'), // share0
      parseUnits('1'), // share1
      BigNumber.from(2), // minSwapPrice
      BigNumber.from(3), // maxSwapPrice
      false, // wrap
      true, // swap
      TEST_ADDRESS, // to
      gasPrice, // gasPrice
      BigNumber.from('100000'), // gasLimit
      validAfterTimestamp,
      BigNumber.from('222222'),
    ] as const
    const tx = await orders._enqueueDepositOrder(...depositOrder, overrides)
    await expect(Promise.resolve(tx)).to.emit(orders, 'DepositEnqueued').withArgs(1, validAfterTimestamp, gasPrice)
    expect(await orders.newestOrderId()).to.eq(1)
    expect(await orders.lastProcessedOrderId()).to.eq(0)
    expect(await orders.getOrder(1)).to.deep.eq([OrderType.Deposit, validAfterTimestamp])
    expect(await orders.getDepositOrder(1)).to.deep.eq([...depositOrder, 0])
  })

  it('enqueueWithdrawOrder', async () => {
    const gasPrice = utils.parseUnits('123.456', 'gwei')
    const validAfterTimestamp = Math.floor(Date.now() / 1000)
    const withdrawOrder = [
      TEST_PAIR_ID,
      parseUnits('1'),
      parseUnits('0.5'),
      parseUnits('0.5'),
      false,
      TEST_ADDRESS,
      gasPrice,
      BigNumber.from('100000'),
      validAfterTimestamp,
    ] as const
    const tx = await orders._enqueueWithdrawOrder(...withdrawOrder, overrides)

    await expect(Promise.resolve(tx)).to.emit(orders, 'WithdrawEnqueued').withArgs(2, validAfterTimestamp, gasPrice)
    expect(await orders.lastProcessedOrderId()).to.eq(0)
    expect(await orders.newestOrderId()).to.eq(2)
    expect(await orders.getOrder(2)).to.deep.eq([OrderType.Withdraw, validAfterTimestamp])
    expect(await orders.getWithdrawOrder(2)).to.deep.eq(withdrawOrder)
  })

  it('enqueueSellOrder', async () => {
    const gasPrice = utils.parseUnits('123.456', 'gwei')
    const validAfterTimestamp = Math.floor(Date.now() / 1000)
    const sellOrder = [
      TEST_PAIR_ID,
      false,
      parseUnits('1'),
      parseUnits('0.5'),
      false,
      TEST_ADDRESS,
      gasPrice,
      BigNumber.from('100000'),
      validAfterTimestamp,
      BigNumber.from('222222'),
      111111,
    ] as const
    const tx = await orders._enqueueSellOrder(...sellOrder, overrides)
    await expect(Promise.resolve(tx)).to.emit(orders, 'SellEnqueued').withArgs(3, validAfterTimestamp, gasPrice)
    expect(await orders.newestOrderId()).to.eq(3)
    expect(await orders.lastProcessedOrderId()).to.eq(0)
    expect(await orders.getOrder(3)).to.deep.eq([OrderType.Sell, validAfterTimestamp])
    expect(await orders.getSellOrder(3)).to.deep.eq(sellOrder)
  })

  it('enqueueBuyOrder', async () => {
    const gasPrice = utils.parseUnits('123.456', 'gwei')
    const validAfterTimestamp = Math.floor(Date.now() / 1000)
    const buyOrder = [
      TEST_PAIR_ID,
      false,
      parseUnits('1'),
      parseUnits('0.5'),
      false,
      TEST_ADDRESS,
      gasPrice,
      BigNumber.from('100000'),
      validAfterTimestamp,
      BigNumber.from('222222'),
      111111,
    ] as const
    const tx = await orders._enqueueBuyOrder(...buyOrder, overrides)
    await expect(Promise.resolve(tx)).to.emit(orders, 'BuyEnqueued').withArgs(4, validAfterTimestamp, gasPrice)
    expect(await orders.newestOrderId()).to.eq(4)
    expect(await orders.lastProcessedOrderId()).to.eq(0)
    expect(await orders.getOrder(4)).to.deep.eq([OrderType.Buy, validAfterTimestamp])
    expect(await orders.getBuyOrder(4)).to.deep.eq(buyOrder)
  })

  it('dequeueDepositOrder', async () => {
    await orders._dequeueDepositOrder(overrides)
    expect(await orders.newestOrderId()).to.eq(4)
    expect(await orders.lastProcessedOrderId()).to.eq(1)
    await orders.forgetLastProcessedOrder()
    await expect(orders.getDepositOrder(1)).to.be.revertedWith('OS32')
  })

  it('dequeueWithdrawOrder', async () => {
    await orders._dequeueWithdrawOrder(overrides)
    expect(await orders.newestOrderId()).to.eq(4)
    expect(await orders.lastProcessedOrderId()).to.eq(2)
    await orders.forgetLastProcessedOrder()
    await expect(orders.getWithdrawOrder(2)).to.be.revertedWith('OS32')
  })

  it('dequeueSellOrder', async () => {
    await orders._dequeueSellOrder(overrides)
    expect(await orders.newestOrderId()).to.eq(4)
    expect(await orders.lastProcessedOrderId()).to.eq(3)
    await orders.forgetLastProcessedOrder()
    await expect(orders.getSellOrder(3)).to.be.revertedWith('OS32')
  })

  it('dequeueBuyOrder', async () => {
    await orders._dequeueBuyOrder(overrides)
    expect(await orders.newestOrderId()).to.eq(4)
    expect(await orders.lastProcessedOrderId()).to.eq(4)
    await orders.forgetLastProcessedOrder()
    await expect(orders.getBuyOrder(4)).to.be.revertedWith('OS32')
  })

  describe('float32 conversions', async () => {
    it('a large number can be encoded and decoded', async () => {
      const number = BigNumber.from(`0xF1E2D3${'0'.repeat(64 - 6)}`)
      const encoded = await orders.uintToFloat32(number)
      const decoded = await orders.float32ToUint(encoded)
      expect(decoded).to.deep.equal(number)
    })

    it('a small number can be encoded and decoded', async () => {
      const number = BigNumber.from(`0x123456`)
      const encoded = await orders.uintToFloat32(number)
      const decoded = await orders.float32ToUint(encoded)
      expect(decoded).to.deep.equal(number)
    })

    it('a medium number can be encoded and decoded', async () => {
      const number = BigNumber.from(`0x12345600000`)
      const encoded = await orders.uintToFloat32(number)
      const decoded = await orders.float32ToUint(encoded)
      expect(decoded).to.deep.equal(number)
    })

    it('numbers that would result in precision loss cannot be encoded', async () => {
      const number = BigNumber.from(`0xABCDE000001`)
      await expect(orders.uintToFloat32(number)).to.be.revertedWith('OS1A')
    })

    it('nubmer 0x1 can be encoded and decoded', async () => {
      const number = BigNumber.from(`0x1`)
      const encoded = await orders.uintToFloat32(number)
      const decoded = await orders.float32ToUint(encoded)
      expect(decoded).to.deep.equal(number)
    })

    it('nubmer 0x2 can be encoded and decoded', async () => {
      const number = BigNumber.from(`0x2`)
      const encoded = await orders.uintToFloat32(number)
      const decoded = await orders.float32ToUint(encoded)
      expect(decoded).to.deep.equal(number)
    })

    it('nubmer 0x3 can be encoded and decoded', async () => {
      const number = BigNumber.from(`0x3`)
      const encoded = await orders.uintToFloat32(number)
      const decoded = await orders.float32ToUint(encoded)
      expect(decoded).to.deep.equal(number)
    })

    it('nubmer 0x6 can be encoded and decoded', async () => {
      const number = BigNumber.from(`0x6`)
      const encoded = await orders.uintToFloat32(number)
      const decoded = await orders.float32ToUint(encoded)
      expect(decoded).to.deep.equal(number)
    })

    it('nubmer 0xa can be encoded and decoded', async () => {
      const number = BigNumber.from(`0xa`)
      const encoded = await orders.uintToFloat32(number)
      const decoded = await orders.float32ToUint(encoded)
      expect(decoded).to.deep.equal(number)
    })

    it('nubmer 0x01000000 can be encoded and decoded', async () => {
      const number = BigNumber.from(`0x01000000`)
      const encoded = await orders.uintToFloat32(number)
      const decoded = await orders.float32ToUint(encoded)
      expect(decoded).to.deep.equal(number)
    })

    it('nubmer 0xffffff can be encoded and decoded', async () => {
      const number = BigNumber.from(`0xffffff`)
      const encoded = await orders.uintToFloat32(number)
      const decoded = await orders.float32ToUint(encoded)
      expect(decoded).to.deep.equal(number)
    })

    it('nubmer 0x01fffff0 can be encoded and decoded', async () => {
      const number = BigNumber.from(`0x01fffff0`)
      const encoded = await orders.uintToFloat32(number)
      const decoded = await orders.float32ToUint(encoded)
      expect(decoded).to.deep.equal(number)
    })

    it('nubmer 0xffffff can be encoded and decoded', async () => {
      const number = BigNumber.from(`0xffffff${'0'.repeat(64 - 6)}`)
      const encoded = await orders.uintToFloat32(number)
      const decoded = await orders.float32ToUint(encoded)
      expect(decoded).to.deep.equal(number)
    })

    it('nubmer 0x01fffffe can be encoded and decoded', async () => {
      const number = BigNumber.from(`0x01fffffe`)
      const encoded = await orders.uintToFloat32(number)
      const decoded = await orders.float32ToUint(encoded)
      expect(decoded).to.deep.equal(number)
    })

    it('nubmer 0x00040...zeros... can be encoded and decoded', async () => {
      const number = BigNumber.from(`0x00040${'0'.repeat(64 - 5)}`)
      const encoded = await orders.uintToFloat32(number)
      const decoded = await orders.float32ToUint(encoded)
      expect(decoded).to.deep.equal(number)
    })

    it('nubmer 0x00080...zeros... can be encoded and decoded', async () => {
      const number = BigNumber.from(`0x80${'0'.repeat(64 - 5)}`)
      const encoded = await orders.uintToFloat32(number)
      const decoded = await orders.float32ToUint(encoded)
      expect(decoded).to.deep.equal(number)
    })

    it('nubmer 0x40...zeros... can be encoded and decoded', async () => {
      const number = BigNumber.from(`0x40${'0'.repeat(64 - 2)}`)
      const encoded = await orders.uintToFloat32(number)
      const decoded = await orders.float32ToUint(encoded)
      expect(decoded).to.deep.equal(number)
    })

    it('nubmer 0x80...zeros... can be encoded and decoded', async () => {
      const number = BigNumber.from(`0x80${'0'.repeat(64 - 2)}`)
      const encoded = await orders.uintToFloat32(number)
      const decoded = await orders.float32ToUint(encoded)
      expect(decoded).to.deep.equal(number)
    })

    it('nubmer 0xffffff...zeros... can be encoded and decoded', async () => {
      const number = BigNumber.from(`0xffffff${'0'.repeat(64 - 6)}`)
      const encoded = await orders.uintToFloat32(number)
      const decoded = await orders.float32ToUint(encoded)
      expect(decoded).to.deep.equal(number)
    })

    it('nubmer 0x01fffffe...zeros... can be encoded and decoded', async () => {
      const number = BigNumber.from(`0x01fffffe${'0'.repeat(64 - 8)}`)
      const encoded = await orders.uintToFloat32(number)
      const decoded = await orders.float32ToUint(encoded)
      expect(decoded).to.deep.equal(number)
    })

    it('nubmer 0x01ffffff would result in precision loss cannot be encoded', async () => {
      const number = BigNumber.from(`0x01ffffff`)
      await expect(orders.uintToFloat32(number)).to.be.revertedWith('OS1A')
    })

    it('nubmer 0x3fffffe would result in precision loss cannot be encoded', async () => {
      const number = BigNumber.from(`0x3fffffe`)
      await expect(orders.uintToFloat32(number)).to.be.revertedWith('OS1A')
    })

    it('nubmer 0x01ffffff00000 would result in precision loss cannot be encoded', async () => {
      const number = BigNumber.from(`0x01ffffff00000`)
      await expect(orders.uintToFloat32(number)).to.be.revertedWith('OS1A')
    })

    it('nubmer 0x3fffffe00000 would result in precision loss cannot be encoded', async () => {
      const number = BigNumber.from(`0x3fffffe00000`)
      await expect(orders.uintToFloat32(number)).to.be.revertedWith('OS1A')
    })

    it('nubmer 0x01ffffff...zeros... would result in precision loss cannot be encoded', async () => {
      const number = BigNumber.from(`0x01ffffff${'0'.repeat(64 - 8)}`)
      await expect(orders.uintToFloat32(number)).to.be.revertedWith('OS1A')
    })

    it('nubmer 0x3fffffe...zeros... would result in precision loss cannot be encoded', async () => {
      const number = BigNumber.from(`0x3fffffe${'0'.repeat(64 - 7)}`)
      await expect(orders.uintToFloat32(number)).to.be.revertedWith('OS1A')
    })
  })
})
