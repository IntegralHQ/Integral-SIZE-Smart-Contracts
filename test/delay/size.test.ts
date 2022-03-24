import { expect } from 'chai'
import chalk from 'chalk'
import { TwapDelay__factory } from '../../build/types'

describe('TwapDelay size', () => {
  const maxSize = 24_576 // As per EIP-170
  const size = TwapDelay__factory.bytecode.length / 2

  before(() => {
    console.log(chalk.gray('      size:'), size)
  })

  it(`is less than or equal ${maxSize} B`, () => {
    expect(size).to.be.lessThanOrEqual(maxSize)
  })
})
