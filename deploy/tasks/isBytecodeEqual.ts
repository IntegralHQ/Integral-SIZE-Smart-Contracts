const MAX_BYTECODE_DIFF = 15

export function isBytecodeEqual(deployed: string, compiled: string, address: string) {
  const deployedNormalized = sanitize(deployed, address)
  const compiledNormalized = sanitize(compiled, address)
  const isEqual = compiledNormalized.includes(deployedNormalized)
  const diff = isEqual ? { deployed: [] } : findDifferences(deployedNormalized, compiledNormalized)
  return isEqual || diff.deployed.length < MAX_BYTECODE_DIFF
}

const BZZR1_PATTERN = /65627a7a72305820[a-f\d]{64}/g
const IPFS_PATTERN = /64697066735822[a-f\d]{68}/g
const ADDRESS_PATTERN = /730{40}3014/g

function normalize(bytecode: string) {
  return bytecode.replace(/^0x/, '').toLowerCase()
}

function sanitize(bytecode: string, address: string) {
  return normalize(bytecode)
    .replace(BZZR1_PATTERN, '0'.repeat(80))
    .replace(IPFS_PATTERN, '0'.repeat(82))
    .replace(ADDRESS_PATTERN, `73${normalize(address)}3014`)
}

// deployed: HERE_IS_DEPLOYED_BYTECODE
// compiled: DIFFERENT_BEGINNING_AND_HERE_IS_DEPLOYED_BYTECODE

export function findDifferences(deployed: string, compiled: string) {
  const twentyPercentLength = Math.floor(deployed.length * 0.2)
  const beginning = deployed.slice(0, twentyPercentLength) // get the beginning of the deployed bytecode e.g. 'HERE_IS'
  const splitted = compiled.split(beginning) // split the compiled bytecode with the beginning of the deployed bytecode e.g. DIFFERENT_BEGINNING_AND_HERE_IS_DEPLOYED_BYTECODE.split('HERE_IS') => ['DIFFERENT_BEGINNING_AND_', '_DEPLOYED_BYTECODE']
  const [, ...toJoin] = splitted // get rid of the beginning of compiled e.g. toJoin = '_DEPLOYED_BYTECODE'
  const compiledWithoutBeginning = [beginning, toJoin.join(beginning)].join('') // join beginning and the rest of the bytecode e.g. ['HERE_IS', '_DEPLOYED_BYTECODE].join('') => 'HERE_IS_DEPLOYED_BYTECODE'
  const diff = { deployed: [] as string[], compiled: [] as string[] }

  if (deployed.length !== compiledWithoutBeginning.length) {
    return { deployed: [...deployed], compiled: [...compiled] }
  }
  for (let i = 0; i < deployed.length; i++) {
    if (deployed[i] !== compiledWithoutBeginning[i]) {
      if (deployed[i] == '0' || compiledWithoutBeginning[i] == '0') {
        break
      }
      // if the current characters are different in deployed and compiled bytecodes add them to the diff
      diff.deployed.push(deployed[i])
      diff.compiled.push(compiledWithoutBeginning[i])
    }
  }
  return diff
}
