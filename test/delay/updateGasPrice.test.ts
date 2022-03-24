import { expect } from 'chai'
import { constants, utils } from 'ethers'
import { depositAndWait } from '../shared/orders'
import { delayFixture } from '../shared/fixtures'
import { setupFixtureLoader } from '../shared/setup'
import { overrides } from '../shared/utilities'
import { DelayTest__factory } from '../../build/types'

describe('TwapDelay.updateGasPrice', () => {
  const loadFixture = setupFixtureLoader()

  it('is set to deployment tx gas price', async () => {
    const { delay } = await loadFixture(delayFixture)
    const { effectiveGasPrice } = await delay.deployTransaction.wait()
    expect(await delay.gasPrice()).to.equal(effectiveGasPrice.div(1000000).mul(1000000))
  })

  it('cut the initial gasPrice precision', async () => {
    const { factory, weth, libraries, wallet } = await loadFixture(delayFixture)
    const delay = await new DelayTest__factory(libraries, wallet).deploy(
      factory.address,
      weth.address,
      constants.AddressZero,
      {
        gasPrice: 1111111111111,
      }
    )
    expect(await delay.gasPrice()).to.eq(1111111000000)
  })

  it('updates on execute', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
    await depositAndWait(delay, token0, token1, wallet, {
      gasPrice: utils.parseUnits('20', 'gwei'),
    })
    expect(await delay.gasPrice()).to.equal(utils.parseUnits('20', 'gwei'))

    const tx = await delay.execute(1, {
      ...overrides,
      gasPrice: utils.parseUnits('40', 'gwei'),
    })
    const gasUsed = (await tx.wait()).gasUsed

    const minResult = utils.parseUnits('20', 'gwei').add(gasUsed.mul(100))
    expect(await delay.gasPrice()).to.gt(minResult.div(1e6).mul(1e6))
  })

  it('can lower gas price', async () => {
    const { delay, token0, token1, wallet } = await loadFixture(delayFixture)
    await depositAndWait(delay, token0, token1, wallet, {
      gasPrice: utils.parseUnits('20', 'gwei'),
    })
    const tx = await delay.execute(1, {
      ...overrides,
      gasPrice: utils.parseUnits('10', 'gwei'),
    })
    const gasUsed = (await tx.wait()).gasUsed
    const maxResult = utils.parseUnits('20', 'gwei').sub(gasUsed.mul(50))
    expect(await delay.gasPrice()).to.lt(maxResult.div(1e6).mul(1e6))
  })

  it('has a precision of 0.001 gwei', async () => {
    const { delay } = await loadFixture(delayFixture)
    await delay.setGasPrice(utils.parseUnits('20', 'gwei'), overrides)
    await delay.testUpdateGasPrice(500_000, {
      ...overrides,
      gasPrice: utils.parseUnits('21.95', 'gwei'),
    })
    expect(await delay.gasPrice()).to.equal(utils.parseUnits('20.048', 'gwei'))
  })

  const testCases = [
    { gasUsed: 10 ** 7, txGasPrice: 200, expected: 29 },
    { gasUsed: 50000, txGasPrice: 200, expected: 20.45 },
    { gasUsed: 10 ** 7, txGasPrice: 10, expected: 19.5 },
    { gasUsed: 50000, txGasPrice: 10, expected: 19.975 },
  ]

  for (const { gasUsed, txGasPrice, expected } of testCases) {
    it(`gasUsed=${gasUsed} txGasPrice=${utils.formatUnits(txGasPrice, 'gwei')}`, async () => {
      const { delay } = await loadFixture(delayFixture)
      await delay.setGasPrice(utils.parseUnits('20', 'gwei'), overrides)
      await delay.testUpdateGasPrice(gasUsed, {
        ...overrides,
        gasPrice: utils.parseUnits(txGasPrice.toString(), 'gwei'),
      })
      expect(await delay.gasPrice()).to.equal(utils.parseUnits(expected.toString(), 'gwei'))
    })
  }
})
