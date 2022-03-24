import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { delayFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'

describe('TwapDelay.setTransferGasCost', () => {
  const loadFixture = setupFixtureLoader()

  it('can be changed', async () => {
    const { delay, other, token0 } = await loadFixture(delayFixture)
    await expect(delay.connect(other.address).setTransferGasCost(token0.address, 50000)).to.be.revertedWith('TD00')

    await expect(delay.setTransferGasCost(token0.address, 50000, overrides))
      .to.emit(delay, 'TransferGasCostSet')
      .withArgs(token0.address, BigNumber.from(50000))
    expect(await delay.getTransferGasCost(token0.address)).to.equal(50000)
  })
})
