import { expect } from 'chai'
import chalk from 'chalk'
import TwapLimitOrderArtifact from '../../build/artifacts/contracts/TwapLimitOrder.sol/TwapLimitOrder.json'

describe('TwapLimitOrder size', () => {
  const maxSize = 24_576 // As per EIP-170
  const size = (TwapLimitOrderArtifact.deployedBytecode.length - 2) / 2 // Account for the '0x' prefix

  before(() => {
    console.log(chalk.gray('      size:'), size)
  })

  it(`is less than or equal ${maxSize} B`, () => {
    expect(size).to.be.lessThanOrEqual(maxSize)
  })
})
