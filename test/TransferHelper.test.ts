import { expect } from 'chai'
import { constants, Wallet } from 'ethers'

import {
  TransferHelperTest__factory,
  TransferHelperTestFakeFallback__factory as FakeFallback__factory,
  TransferHelperTestFakeERC20Noncompliant__factory as FakeERC20Noncompliant__factory,
  TransferHelperTestFakeERC20Compliant__factory as FakeERC20Compliant__factory,
  TransferHelperTest,
  TransferHelperTestFakeFallback,
  TransferHelperTestFakeERC20Compliant,
  TransferHelperTestFakeERC20Noncompliant,
} from '../build/types'
import { setupFixtureLoader } from './shared/setup'
import { overrides } from './shared/utilities'

describe('TransferHelper', () => {
  const loadFixture = setupFixtureLoader()

  async function fixture([wallet]: Wallet[]) {
    return {
      transferHelper: await new TransferHelperTest__factory(wallet).deploy(overrides),
      fakeFallback: await new FakeFallback__factory(wallet).deploy(overrides),
      fakeNoncompliant: await new FakeERC20Noncompliant__factory(wallet).deploy(overrides),
      fakeCompliant: await new FakeERC20Compliant__factory(wallet).deploy(overrides),
    }
  }

  let transferHelper: TransferHelperTest
  let fakeFallback: TransferHelperTestFakeFallback
  let fakeCompliant: TransferHelperTestFakeERC20Compliant
  let fakeNoncompliant: TransferHelperTestFakeERC20Noncompliant
  before(async () => {
    ;({ transferHelper, fakeFallback, fakeCompliant, fakeNoncompliant } = await loadFixture(fixture))
  })

  // sets up the fixtures for each token situation that should be tested
  function harness({
    sendTx,
    expectedError,
  }: {
    sendTx: (tokenAddress: string) => Promise<any>
    expectedError: string
  }) {
    it('succeeds with compliant with no revert and true return', async () => {
      await fakeCompliant.setup(true, false, overrides)
      await sendTx(fakeCompliant.address)
    })
    it('fails with compliant with no revert and false return', async () => {
      await fakeCompliant.setup(false, false, overrides)
      await expect(sendTx(fakeCompliant.address)).to.be.revertedWith(expectedError)
    })
    it('fails with compliant with revert', async () => {
      await fakeCompliant.setup(false, true, overrides)
      await expect(sendTx(fakeCompliant.address)).to.be.revertedWith(expectedError)
    })
    it('succeeds with noncompliant (no return) with no revert', async () => {
      await fakeNoncompliant.setup(false, overrides)
      await sendTx(fakeNoncompliant.address)
    })
    it('fails with noncompliant (no return) with revert', async () => {
      await fakeNoncompliant.setup(true, overrides)
      await expect(sendTx(fakeNoncompliant.address)).to.be.revertedWith(expectedError)
    })
  }

  describe('safeApprove', () => {
    harness({
      sendTx: (tokenAddress) =>
        transferHelper.safeApprove(tokenAddress, constants.AddressZero, constants.MaxUint256, overrides),
      expectedError: 'TH4B',
    })
  })
  describe('safeTransfer', () => {
    harness({
      sendTx: (tokenAddress) =>
        transferHelper.safeTransfer(tokenAddress, constants.AddressZero, constants.MaxUint256, overrides),
      expectedError: 'TH05',
    })
  })
  describe('safeTransferFrom', () => {
    harness({
      sendTx: (tokenAddress) =>
        transferHelper.safeTransferFrom(
          tokenAddress,
          constants.AddressZero,
          constants.AddressZero,
          constants.MaxUint256,
          overrides
        ),
      expectedError: 'TH0E',
    })
  })

  describe('safeTransferETH', () => {
    it('succeeds call not reverted', async () => {
      await fakeFallback.setup(false, overrides)
      await transferHelper.safeTransferETH(fakeFallback.address, 0, 2200, overrides)
    })
    it('fails if call reverts', async () => {
      await fakeFallback.setup(true, overrides)
      await expect(transferHelper.safeTransferETH(fakeFallback.address, 0, 0, overrides)).to.be.revertedWith('TH3F')
    })
  })
})
