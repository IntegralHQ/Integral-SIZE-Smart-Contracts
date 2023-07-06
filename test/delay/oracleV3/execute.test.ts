import { expect } from 'chai'
import { deposit, depositAndWait } from '../../shared/orders'
import { delayOracleV3Fixture } from '../../shared/fixtures'
import { setupFixtureLoader } from '../../shared/setup'
import { expandTo18Decimals, getEthRefund, getEvents, getGasSpent, mineBlock, overrides } from '../../shared/utilities'
import { encodeErrorData } from '../../shared/solidityError'
import { delayFailingOracleV3Fixture } from '../../shared/fixtures/delayFailingOracleV3Fixture'
import { BigNumber, providers } from 'ethers'

describe('TwapDelay.execute.oracleV3', () => {
  const loadFixture = setupFixtureLoader()

  it('can execute multiple orders', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)

    const result0 = await deposit(delay, token0, token1, wallet)
    const result1 = await depositAndWait(delay, token0, token1, wallet)

    const tx = await delay.execute(result0.orderData.concat(result1.orderData), overrides)
    const events = await getEvents(tx, 'OrderExecuted')

    const lastProcessedOrderId = await delay.lastProcessedOrderId()
    const newestOrderId = await delay.newestOrderId()

    expect(events.length).to.equal(2)
    expect(lastProcessedOrderId).to.equal(newestOrderId)
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(2, true, '0x', getGasSpent(events[1]), getEthRefund(events[1]))
  })

  it('should fail if execute more orders than there are in the queue', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)

    const result = await depositAndWait(delay, token0, token1, wallet)
    const fakeOrderData = result.orderData[0]
    fakeOrderData.orderId = BigNumber.from(result.orderData[0].orderId).add(1)

    await expect(delay.execute(result.orderData.concat(fakeOrderData), overrides)).to.revertedWith('OS71')
  })

  it('should fail if execution sequence is changed', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)

    const result0 = await deposit(delay, token0, token1, wallet)
    const result1 = await depositAndWait(delay, token0, token1, wallet)
    const orderData = result1.orderData.concat(result0.orderData)

    await expect(delay.execute(orderData, overrides)).to.revertedWith('OS72')
  })

  it('can execute less orders if some of them are not yet ready', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)

    const result0 = await depositAndWait(delay, token0, token1, wallet)
    const result1 = await deposit(delay, token0, token1, wallet)

    const tx = await delay.execute(result0.orderData.concat(result1.orderData), overrides)
    const executions = (await getEvents(tx, 'OrderExecuted'))?.length

    const lastProcessedOrderId = await delay.lastProcessedOrderId()
    const newestOrderId = await delay.newestOrderId()

    expect(executions).to.equal(1)
    expect(lastProcessedOrderId).to.equal(newestOrderId.sub(1))
  })

  it('can execute less orders if all orders are ready', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)

    const result = await deposit(delay, token0, token1, wallet)
    await depositAndWait(delay, token0, token1, wallet)

    const tx = await delay.execute(result.orderData, overrides)
    const executions = (await getEvents(tx, 'OrderExecuted'))?.length

    const lastProcessedOrderId = await delay.lastProcessedOrderId()
    const newestOrderId = await delay.newestOrderId()

    expect(executions).to.equal(1)
    expect(lastProcessedOrderId).to.equal(newestOrderId.sub(1))
  })

  it('can execute orders after refund fail', async () => {
    const { delay, oracle, token0, token1, deployAnotherPair, wallet, addLiquidity } = await loadFixture(
      delayFailingOracleV3Fixture
    )
    const { token2, token3, addAnotherLiquidity } = await deployAnotherPair()
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await addAnotherLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await oracle.setTwapInterval(1)

    const result0 = await deposit(delay, token0, token1, wallet)
    const result1 = await deposit(delay, token2, token3, wallet)
    const result2 = await depositAndWait(delay, token2, token3, wallet)
    const orderData = result0.orderData.concat(result1.orderData).concat(result2.orderData)

    await token0.setWasteTransferGas(true, overrides)
    const tx = await delay.execute(orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, false, encodeErrorData('TH05'), getGasSpent(events[0]), getEthRefund(events[0]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(2, true, '0x', getGasSpent(events[1]), getEthRefund(events[1]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(3, true, '0x', getGasSpent(events[2]), getEthRefund(events[2]))
  })

  it('can omit canceled orders', async () => {
    const { delay, oracle, token0, token1, deployAnotherPair, wallet, addLiquidity } = await loadFixture(
      delayFailingOracleV3Fixture
    )
    const { token2, token3, addAnotherLiquidity } = await deployAnotherPair()
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await addAnotherLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await oracle.setTwapInterval(1)

    const result0 = await deposit(delay, token0, token1, wallet)
    const result1 = await deposit(delay, token2, token3, wallet)
    const result2 = await depositAndWait(delay, token2, token3, wallet)
    const orderData = result0.orderData.concat(result1.orderData).concat(result2.orderData)

    await (delay.provider as providers.JsonRpcProvider).send('evm_increaseTime', [24 * 60 * 60])
    await mineBlock(wallet)
    await delay.cancelOrder(result0.orderData[0], overrides)

    const tx = await delay.execute(orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(2, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(3, true, '0x', getGasSpent(events[1]), getEthRefund(events[1]))
  })

  it('anyone can execute after 20 minutes', async () => {
    const { delay, token0, token1, wallet, other } = await loadFixture(delayOracleV3Fixture)
    await delay.setBot(wallet.address, true, overrides)

    const result = await depositAndWait(delay, token0, token1, wallet)
    await (delay.provider as providers.JsonRpcProvider).send('evm_increaseTime', [20 * 60 + 1])
    const delayFromOther = delay.connect(other)
    const tx = await delayFromOther.execute(result.orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')

    await expect(Promise.resolve(tx))
      .to.emit(delayFromOther, 'OrderExecuted')
      .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
  })

  it('anyone can execute if bot is address 0', async () => {
    const { delay, token0, token1, wallet, other } = await loadFixture(delayOracleV3Fixture)
    const result = await depositAndWait(delay, token0, token1, wallet)

    const delayFromOther = delay.connect(other)
    const tx = await delayFromOther.execute(result.orderData, overrides)
    const events = await getEvents(tx, 'OrderExecuted')

    await expect(Promise.resolve(tx))
      .to.emit(delayFromOther, 'OrderExecuted')
      .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
  })
})
