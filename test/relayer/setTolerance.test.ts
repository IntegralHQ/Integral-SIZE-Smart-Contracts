import { expect } from 'chai'
import { relayerFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'

describe('TwapRelayer.setTolerance', () => {
  const loadFixture = setupFixtureLoader()
  const EXPECTED_MAX_TOLERANCE = 10

  it('can only be called by the owner', async () => {
    const { relayer, pair, other } = await loadFixture(relayerFixture)
    await expect(relayer.connect(other).setTolerance(pair.address, 1111, overrides)).to.be.revertedWith('TR00')
  })

  it('cannot be set to same value', async () => {
    const { relayer, pair } = await loadFixture(relayerFixture)
    const tolerance = await relayer.tolerance(pair.address)
    await expect(relayer.setTolerance(pair.address, tolerance, overrides)).to.be.revertedWith('TR01')
  })

  it('succeds below tolerance limit', async () => {
    const { relayer, pair } = await loadFixture(relayerFixture)

    await relayer.setTolerance(pair.address, 1, overrides)
    let tolerance = await relayer.tolerance(pair.address)
    expect(tolerance).to.eq(1)

    await relayer.setTolerance(pair.address, 0, overrides)
    tolerance = await relayer.tolerance(pair.address)
    expect(tolerance).to.eq(0)

    await relayer.setTolerance(pair.address, EXPECTED_MAX_TOLERANCE, overrides)
    tolerance = await relayer.tolerance(pair.address)
    expect(tolerance).to.eq(EXPECTED_MAX_TOLERANCE)
  })

  it('emits an event', async () => {
    const { relayer, pair } = await loadFixture(relayerFixture)
    expect(await relayer.setTolerance(pair.address, 2, overrides))
      .to.emit(relayer, 'ToleranceSet')
      .withArgs(pair.address, 2)
  })

  it('fails on exceeded tolerance limit', async () => {
    const { relayer, pair } = await loadFixture(relayerFixture)
    await expect(relayer.setTolerance(pair.address, EXPECTED_MAX_TOLERANCE + 1, overrides)).to.be.revertedWith('TR54')
  })
})
