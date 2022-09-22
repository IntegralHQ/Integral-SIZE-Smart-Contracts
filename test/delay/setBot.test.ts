import { expect } from 'chai'
import { constants } from 'ethers'
import { delayFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'

describe('TwapDelay.setBot', () => {
  const loadFixture = setupFixtureLoader()

  it('is set to the specified in the constructor address', async () => {
    const { delay, wallet } = await loadFixture(delayFixture)
    expect(await delay.isBot(wallet.address)).to.be.false
    expect(await delay.isBot(constants.AddressZero)).to.be.true
  })

  it('can be changed', async () => {
    const { delay, other } = await loadFixture(delayFixture)
    await expect(delay.connect(other).setBot(other.address, true, overrides)).to.be.revertedWith('TD00')
    expect(await delay.isBot(other.address)).to.be.false
    await expect(delay.setBot(other.address, true, overrides)).to.emit(delay, 'BotSet').withArgs(other.address, true)
    expect(await delay.isBot(other.address)).to.be.true
    await expect(delay.setBot(other.address, false, overrides)).to.emit(delay, 'BotSet').withArgs(other.address, false)
  })

  it.skip('performs address checks when setting bot', async () => {
    const { delay, other } = await loadFixture(delayFixture)
    await expect(delay.setBot(other.address, true, overrides)).to.emit(delay, 'BotSet').withArgs(other.address, true)
    await expect(delay.setBot(other.address, true, overrides)).to.be.revertedWith('TD01')
  })
})
