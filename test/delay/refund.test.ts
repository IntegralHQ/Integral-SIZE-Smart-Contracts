import { expect } from 'chai'
import { EtherHater__factory } from '../../build/types'
import { depositAndWait, sortTokens } from '../shared/orders'
import { delayFixture } from '../shared/fixtures'
import { delayFailingFixture } from '../shared/fixtures/delayFailingFixture'
import { setupFixtureLoader } from '../shared/setup'
import { encodeErrorData } from '../shared/solidityError'
import { expandTo18Decimals, getEthRefund, getEvents, getGasSpent, overrides } from '../shared/utilities'

describe('TwapDelay.refund', () => {
  const loadFixture = setupFixtureLoader()

  it('reverts if bot eth refund fails', async () => {
    const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayFixture)
    const etherHater = await new EtherHater__factory(wallet).deploy(overrides)

    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await depositAndWait(delay, token0, token1, wallet, {
      amount0: expandTo18Decimals(1),
      amount1: expandTo18Decimals(1),
    })

    await expect(etherHater.callExecute(delay.address, overrides)).to.be.revertedWith('TD40')
  })

  it('succeeds even if refund fails because of balanceOf', async () => {
    const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayFailingFixture)

    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    const deposit = await depositAndWait(delay, token0, token1, wallet, {
      amount0: expandTo18Decimals(1),
      amount1: expandTo18Decimals(1),
    })

    await token0.setRevertBalanceOf(true, overrides)
    const tx = await delay.execute(1, overrides)
    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, false, encodeErrorData('FA_BALANCE_OF_OOPS'), getGasSpent(events[0]), getEthRefund(events[0]))
      .to.emit(delay, 'RefundFailed')
      .withArgs(wallet.address, token0.address, deposit.amount0, encodeErrorData('FA_BALANCE_OF_OOPS'))
  })

  it('succeeds even if refund fails because of transfer', async () => {
    const { delay, token0, token1, wallet, addLiquidity } = await loadFixture(delayFailingFixture)

    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    const deposit = await depositAndWait(delay, token0, token1, wallet, {
      amount0: expandTo18Decimals(1),
      amount1: expandTo18Decimals(1),
    })

    await token0.setRevertAfter(await token0.totalTransfers(), overrides)
    const tx = await delay.execute(1, overrides)
    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, false, encodeErrorData('TH05'), getGasSpent(events[0]), getEthRefund(events[0]))
      .to.emit(delay, 'RefundFailed')
      .withArgs(wallet.address, token0.address, deposit.amount0, encodeErrorData('TH05'))
  })

  it('succeeds even if user eth refund fails', async () => {
    const { delay, token0, token1, wallet, other, addLiquidity } = await loadFixture(delayFixture)
    const etherHater = await new EtherHater__factory(wallet).deploy(overrides)

    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await depositAndWait(delay, token0, token1, etherHater, {
      amount0: expandTo18Decimals(1),
      amount1: expandTo18Decimals(1),
    })

    const tx = await delay.connect(other).execute(1, overrides)
    const receipt = await tx.wait()
    const ethRefunds = receipt.events?.filter((x) => x.event === 'EthRefund') ?? []
    const [botRefundEvent, userRefundEvent] = ethRefunds

    const events = await getEvents(tx, 'OrderExecuted')
    await expect(Promise.resolve(tx))
      .to.emit(delay, 'OrderExecuted')
      .withArgs(1, true, '0x', getGasSpent(events[0]), getEthRefund(events[0]))
      .to.emit(delay, 'EthRefund')
      .withArgs(other.address, true, botRefundEvent.args?.[2])
      .to.emit(delay, 'EthRefund')
      .withArgs(etherHater.address, false, userRefundEvent.args?.[2])
  })

  it('refund unwraps weth if it was wrapped when depositing', async () => {
    const { delay, token, weth, wallet } = await loadFixture(delayFixture)

    const [token0, token1] = sortTokens(token, weth)
    await depositAndWait(delay, token0, token1, wallet, {
      etherAmount: expandTo18Decimals(1),
      wrap: true,
      amount0: expandTo18Decimals(1),
      amount1: expandTo18Decimals(1),
    })
    await delay.execute(1, overrides)

    await depositAndWait(delay, token0, token1, wallet, {
      etherAmount: expandTo18Decimals(2),
      wrap: true,
      amount0: expandTo18Decimals(token0 === weth ? 2 : 1),
      amount1: expandTo18Decimals(token1 === weth ? 2 : 1),
      gasLimit: 200000,
    })

    const balanceBefore = await wallet.getBalance()
    await delay.execute(1, overrides)
    const balanceAfter = await wallet.getBalance()

    expect(balanceAfter.sub(balanceBefore)).to.be.gt(expandTo18Decimals(2))
  })
})
