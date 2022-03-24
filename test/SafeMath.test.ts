import { expect } from 'chai'
import { utils, Wallet } from 'ethers'
import { setupFixtureLoader } from './shared/setup'
import { overrides } from './shared/utilities'
import { SafeMathTest, SafeMathTest__factory } from '../build/types'

describe('SafeMath', () => {
  const loadFixture = setupFixtureLoader()

  async function fixture([wallet]: Wallet[]) {
    const contract = await new SafeMathTest__factory(wallet).deploy(overrides)
    return { contract }
  }

  let contract: SafeMathTest

  before(async () => {
    ;({ contract } = await loadFixture(fixture))
  })

  describe('add', () => {
    it('positive numbers', async () => {
      const a = utils.parseUnits('1.3')
      const b = utils.parseUnits('0.5')
      const expected = utils.parseUnits('1.8')
      expect(await contract.add(a, b, overrides)).to.eq(expected)
      expect(await contract.add(b, a, overrides)).to.eq(expected)
    })

    it('mixed numbers', async () => {
      const a = utils.parseUnits('1.3')
      const b = utils.parseUnits('-0.5')
      const expected = utils.parseUnits('0.8')
      expect(await contract.add(a, b, overrides)).to.eq(expected)
      expect(await contract.add(b, a, overrides)).to.eq(expected)
    })

    it('negative numbers', async () => {
      const a = utils.parseUnits('-1.3')
      const b = utils.parseUnits('-0.5')
      const expected = utils.parseUnits('-1.8')
      expect(await contract.add(a, b, overrides)).to.eq(expected)
      expect(await contract.add(b, a, overrides)).to.eq(expected)
    })
  })

  describe('sub', () => {
    it('positive numbers', async () => {
      const a = utils.parseUnits('1.3')
      const b = utils.parseUnits('0.5')
      expect(await contract.sub(a, b, overrides)).to.eq(utils.parseUnits('0.8'))
      expect(await contract.sub(b, a, overrides)).to.eq(utils.parseUnits('-0.8'))
    })

    it('mixed numbers', async () => {
      const a = utils.parseUnits('1.3')
      const b = utils.parseUnits('-0.5')
      expect(await contract.sub(a, b, overrides)).to.eq(utils.parseUnits('1.8'))
      expect(await contract.sub(b, a, overrides)).to.eq(utils.parseUnits('-1.8'))
    })

    it('negative numbers', async () => {
      const a = utils.parseUnits('-1.3')
      const b = utils.parseUnits('-0.5')
      expect(await contract.sub(a, b, overrides)).to.eq(utils.parseUnits('-0.8'))
      expect(await contract.sub(b, a, overrides)).to.eq(utils.parseUnits('0.8'))
    })
  })
})
