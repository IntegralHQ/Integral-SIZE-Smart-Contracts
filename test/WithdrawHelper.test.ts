import { expect } from 'chai'
import { withdrawHelperFixture } from './shared/fixtures'
import { setupFixtureLoader } from './shared/setup'
import { expandTo18Decimals, overrides } from './shared/utilities'

describe('WithdrawHelper', () => {
  const fixtureLoader = setupFixtureLoader()
  describe('_transferToken', () => {
    it('sends correct token amount', async () => {
      const { withdrawHelper, other, token } = await fixtureLoader(withdrawHelperFixture)

      const contractBalanceBefore = expandTo18Decimals(95)
      const contractBalance = expandTo18Decimals(100)
      await token.setBalance(withdrawHelper.address, contractBalance, overrides)

      await withdrawHelper.transferToken(contractBalanceBefore, token.address, other.address, overrides)

      expect(await token.balanceOf(other.address)).to.deep.eq(contractBalance.sub(contractBalanceBefore))
    })

    it('reverts when transfered value is negative', async () => {
      const { withdrawHelper, wallet, token } = await fixtureLoader(withdrawHelperFixture)
      await token.setBalance(wallet.address, expandTo18Decimals(10), overrides)
      await expect(
        withdrawHelper.transferToken(expandTo18Decimals(12), token.address, wallet.address, overrides)
      ).to.revertedWith('SM12')
    })
  })
})
