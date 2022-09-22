import { expect } from 'chai'
import chalk from 'chalk'
import TwapDelayArtifact from '../../build/artifacts/contracts/TwapDelay.sol/TwapDelay.json'

describe('TwapDelay size', () => {
  const maxSize = 24_576 // As per EIP-170
  const size = (TwapDelayArtifact.deployedBytecode.length - 2) / 2 // Account for the '0x' prefix

  before(() => {
    console.log(chalk.gray('      size:'), size)
  })

  it(`is less than or equal ${maxSize} B`, () => {
    expect(size).to.be.lessThanOrEqual(maxSize)
  })
})
