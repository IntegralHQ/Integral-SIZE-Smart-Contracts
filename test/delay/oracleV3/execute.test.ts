import { expect } from 'chai'
import { deposit, depositAndWait } from '../../shared/orders'
import { delayOracleV3Fixture } from '../../shared/fixtures'
import { setupFixtureLoader } from '../../shared/setup'
import { expandTo18Decimals, getEthRefund, getEvents, getGasSpent, mineBlock, overrides } from '../../shared/utilities'
import { encodeErrorData } from '../../shared/solidityError'
import { delayFailingOracleV3Fixture } from '../../shared/fixtures/delayFailingOracleV3Fixture'
import { providers } from 'ethers'

describe('TwapDelay.execute.oracleV3', () => {
  const loadFixture = setupFixtureLoader()

  it('can execute multiple orders', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)

    await deposit(delay, token0, token1, wallet)
    await depositAndWait(delay, token0, token1, wallet)

    const tx = await delay.execute(2, overrides)
    const events = await getEvents(tx, 'OrderExecuted')

    await expect(Promise.resolve(tx))
      .to.emit(delay, 'Execute')
      .withArgs(wallet.address, 2)
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(2, true, '0x', getGasSpent(events[1]), getEthRefund(events[1]))
  })

  it('can execute less orders if there are less in the queue', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)

    await depositAndWait(delay, token0, token1, wallet)

    const tx = await delay.execute(2, overrides)
    await expect(Promise.resolve(tx)).to.emit(delay, 'Execute').withArgs(wallet.address, 2)
    const executions = (await getEvents(tx, 'OrderExecuted'))?.length
    expect(executions).to.equal(1)
  })

  it('can execute less orders if some of them are not yet ready', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayOracleV3Fixture)

    await depositAndWait(delay, token0, token1, wallet)
    await deposit(delay, token0, token1, wallet)

    const tx = await delay.execute(2, overrides)
    const executions = (await getEvents(tx, 'OrderExecuted'))?.length
    expect(executions).to.equal(1)
  })

  it('can execute orders after refund fail', async () => {
    const { delay, oracle, token0, token1, deployAnotherPair, wallet, addLiquidity } = await loadFixture(
      delayFailingOracleV3Fixture
    )
    const { token2, token3, addAnotherLiquidity } = await deployAnotherPair()
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await addAnotherLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await oracle.setTwapInterval(1)

    await deposit(delay, token0, token1, wallet)
    await deposit(delay, token2, token3, wallet)
    await depositAndWait(delay, token2, token3, wallet)

    await token0.setWasteTransferGas(true, overrides)
    const tx = await delay.execute(3, overrides)
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

    await deposit(delay, token0, token1, wallet)
    await deposit(delay, token2, token3, wallet)
    await depositAndWait(delay, token2, token3, wallet)

    await (delay.provider as providers.JsonRpcProvider).send('evm_increaseTime', [24 * 60 * 60])
    await mineBlock(wallet)
    await delay.cancelOrder(1, overrides)

    const tx = await delay.execute(3, overrides)
    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'Execute')
      .withArgs(wallet.address, 3)
      .to.emit(delay, 'OrderExecuted')
      .withArgs(2, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(3, true, '0x', getGasSpent(events[1]), getEthRefund(events[1]))
  })

  it('anyone can execute after 20 minutes', async () => {
    const { delay, token0, token1, wallet, other } = await loadFixture(delayOracleV3Fixture)
    await delay.setBot(wallet.address, true, overrides)

    await depositAndWait(delay, token0, token1, wallet)
    await (delay.provider as providers.JsonRpcProvider).send('evm_increaseTime', [20 * 60 + 1])
    const delayFromOther = delay.connect(other)
    const tx = await delayFromOther.execute(2, overrides)
    const events = await getEvents(tx, 'OrderExecuted')

    await expect(Promise.resolve(tx))
      .to.emit(delayFromOther, 'Execute')
      .withArgs(other.address, 2)
      .to.emit(delayFromOther, 'OrderExecuted')
      .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
  })

  it('anyone can execute if bot is address 0', async () => {
    const { delay, token0, token1, wallet, other } = await loadFixture(delayOracleV3Fixture)
    await depositAndWait(delay, token0, token1, wallet)

    const delayFromOther = delay.connect(other)
    const tx = await delayFromOther.execute(1, overrides)
    const events = await getEvents(tx, 'OrderExecuted')

    await expect(Promise.resolve(tx))
      .to.emit(delayFromOther, 'Execute')
      .withArgs(other.address, 1)
      .to.emit(delayFromOther, 'OrderExecuted')
      .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
  })
})
