import { expect } from 'chai'
import { constants } from 'ethers'
import { delayFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'

describe('TwapDelay._refundToken', () => {
  const loadFixture = setupFixtureLoader()

  it('can be called only by itself', async () => {
    const { delay } = await loadFixture(delayFixture)

    await expect(
      delay._refundToken(constants.AddressZero, constants.AddressZero, 0, false, overrides)
    ).to.be.revertedWith('TD00')
  })
})
