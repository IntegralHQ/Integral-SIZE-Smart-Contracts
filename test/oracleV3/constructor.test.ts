import { expect } from 'chai'

import { setupFixtureLoader } from '../shared/setup'
import { oracleV3Fixture } from '../shared/fixtures'

import { TwapOracleV3__factory } from '../../build/types'
import { overrides } from '../shared/utilities'

describe('TwapOracleV3.constructor', () => {
  const loadFixture = setupFixtureLoader()

  it('fails if decimals higher than 75', async () => {
    const { wallet } = await loadFixture(oracleV3Fixture)
    await expect(new TwapOracleV3__factory(wallet).deploy(76, 76, overrides)).to.be.revertedWith('TO4F')
    await expect(new TwapOracleV3__factory(wallet).deploy(76, 60, overrides)).to.be.revertedWith('TO4F')
    await expect(new TwapOracleV3__factory(wallet).deploy(60, 76, overrides)).to.be.revertedWith('TO4F')
  })

  it('fails if decimals difference bigger than 18', async () => {
    const { wallet } = await loadFixture(oracleV3Fixture)
    await expect(new TwapOracleV3__factory(wallet).deploy(37, 18, overrides)).to.be.revertedWith('TO47')
    await expect(new TwapOracleV3__factory(wallet).deploy(18, 37, overrides)).to.be.revertedWith('TO47')
  })
})
