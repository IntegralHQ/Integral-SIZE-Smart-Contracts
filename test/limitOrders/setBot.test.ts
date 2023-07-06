import { expect } from 'chai'
import { constants } from 'ethers'
import { delayFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'

describe('TwapLimitOrder.setBot', () => {
  const loadFixture = setupFixtureLoader()

  it('is set to the specified in the constructor address', async () => {
    const { limitOrder, wallet } = await loadFixture(delayFixture)
    expect(await limitOrder.isBot(wallet.address)).to.be.true
    expect(await limitOrder.isBot(constants.AddressZero)).to.be.false
  })

  it('can be changed', async () => {
    const { limitOrder, other } = await loadFixture(delayFixture)
    await expect(limitOrder.connect(other).setBot(other.address, true, overrides)).to.be.revertedWith('TL00')
    expect(await limitOrder.isBot(other.address)).to.be.false
    await expect(limitOrder.setBot(other.address, true, overrides))
      .to.emit(limitOrder, 'BotSet')
      .withArgs(other.address, true)
    expect(await limitOrder.isBot(other.address)).to.be.true
    await expect(limitOrder.setBot(other.address, false, overrides))
      .to.emit(limitOrder, 'BotSet')
      .withArgs(other.address, false)
  })

  it('performs address checks when setting bot', async () => {
    const { limitOrder, other } = await loadFixture(delayFixture)
    await expect(limitOrder.setBot(other.address, true, overrides))
      .to.emit(limitOrder, 'BotSet')
      .withArgs(other.address, true)
    await expect(limitOrder.setBot(other.address, true, overrides)).to.be.revertedWith('TL01')
  })
})
