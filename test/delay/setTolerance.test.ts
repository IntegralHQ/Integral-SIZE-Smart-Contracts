import { expect } from 'chai'
import { delayFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'

describe('TwapDelay.setTolerance', () => {
  const loadFixture = setupFixtureLoader()
  const EXPECTED_MAX_TOLERANCE = 10

  it('succeds below tolerance limit', async () => {
    const { delay, pair } = await loadFixture(delayFixture)

    await delay.setTolerance(pair.address, 1, overrides)
    let tolerance = await delay.tolerance(pair.address)
    expect(tolerance).to.eq(1)

    await delay.setTolerance(pair.address, 0, overrides)
    tolerance = await delay.tolerance(pair.address)
    expect(tolerance).to.eq(0)

    await delay.setTolerance(pair.address, EXPECTED_MAX_TOLERANCE, overrides)
    tolerance = await delay.tolerance(pair.address)
    expect(tolerance).to.eq(EXPECTED_MAX_TOLERANCE)
  })

  it('emits an event', async () => {
    const { delay, pair } = await loadFixture(delayFixture)
    expect(await delay.setTolerance(pair.address, 2, overrides))
      .to.emit(delay, 'ToleranceSet')
      .withArgs(pair.address, 2)
  })

  it('fails on exceeded tolerance limit', async () => {
    const { delay, pair } = await loadFixture(delayFixture)
    await expect(delay.setTolerance(pair.address, EXPECTED_MAX_TOLERANCE + 1, overrides)).to.be.revertedWith('TD54')
  })
})
