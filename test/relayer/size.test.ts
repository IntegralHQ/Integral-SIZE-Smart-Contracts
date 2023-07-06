import { expect } from 'chai'
import chalk from 'chalk'
import TwapRelayerArtifact from '../../build/artifacts/contracts/TwapRelayer.sol/TwapRelayer.json'
import { MAX_CONTRACT_BYTECODE_SIZE } from '../shared/utilities'

describe('TwapRelayer size', () => {
  const size = (TwapRelayerArtifact.deployedBytecode.length - 2) / 2 // Account for the '0x' prefix

  before(() => {
    console.log(chalk.gray('      size:'), size)
  })

  it(`is less than or equal ${MAX_CONTRACT_BYTECODE_SIZE} B`, () => {
    expect(size).to.be.lessThanOrEqual(MAX_CONTRACT_BYTECODE_SIZE)
  })
})
