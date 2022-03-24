import { expect } from 'chai'
import { findDifferences } from '../deploy/tasks/isBytecodeEqual'

describe('findDifferences', () => {
  it('no differences', () => {
    const deployed = 'aaabbbccc'
    const compiled = `bbb${deployed}`
    expect(findDifferences(deployed, compiled)).to.deep.eq({ deployed: [], compiled: [] })
  })

  it('two differences', () => {
    const deployed = 'aaabbbccc'
    const diff = '11'
    const compiled = `bbb${deployed.slice(0, 2) + diff + deployed.slice(4)}`
    expect(findDifferences(deployed, compiled)).to.deep.eq({
      deployed: [deployed[2], deployed[3]],
      compiled: [diff[0], diff[1]],
    })
  })

  it('no common parts', () => {
    const deployed = 'aaabbbccc'
    const compiled = 'bbccccbbb'
    expect(findDifferences(deployed, compiled)).to.deep.eq({ deployed: [...deployed], compiled: [...compiled] })
  })
})
