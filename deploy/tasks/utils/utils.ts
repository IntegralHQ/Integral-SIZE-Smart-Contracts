import { BigNumber, utils } from 'ethers'
import { arrayify, keccak256 } from 'ethers/lib/utils'
import { TwapFactory, TwapPair__factory } from '../../../build/types'

export function getFirst<T>(tokenA: string, tokenB: string, a: T, b: T) {
  return BigNumber.from(tokenA).lt(tokenB) ? a : b
}

export function getSecond<T>(tokenA: string, tokenB: string, a: T, b: T) {
  return BigNumber.from(tokenA).lt(tokenB) ? b : a
}

export function isAddressEqual(address0: string, address1: string) {
  return address0.toLowerCase() === address1.toLowerCase()
}

export function trimToDecimals(value: string, decimalsNumber: number) {
  const [integer, decimals] = value.split('.')
  return decimals ? [integer, decimals.slice(0, decimalsNumber)].join('.') : integer
}

const NUMBER_REGEX = /^\d*(\.\d*)?$/

export function bigNumberFromString(decimals: number, value: string) {
  value = value.replace(/,/g, '')
  if (!NUMBER_REGEX.test(value)) {
    throw new Error('Invalid value provided')
  }
  let [integer = '', decimal = ''] = value.split('.')
  if (integer === '') {
    integer = '0'
  }
  if (decimal.length < decimals) {
    decimal = decimal.padEnd(decimals, '0')
  } else if (decimal.length > decimals) {
    decimal = decimal.substring(0, decimals)
  }
  return BigNumber.from(integer.concat(decimal))
}

export function sqrt(y: BigNumber): BigNumber {
  let z = y
  if (y.gt(3)) {
    let x = y.div(2).add(1)
    while (x.lt(z)) {
      z = x
      x = y.div(x).add(x).div(2)
    }
  } else if (!y.eq(0)) {
    z = BigNumber.from(1)
  }
  return z
}

export function getPairAddress(factory: string, token0: string, token1: string, initCode: string): string {
  const sortedTokens = BigNumber.from(token0).lt(BigNumber.from(token1)) ? [token0, token1] : [token1, token0]
  return utils.getCreate2Address(
    factory,
    utils.solidityKeccak256(['address', 'address'], sortedTokens),
    keccak256(initCode)
  )
}

export function getPairId(pairAddress: string): number {
  return Buffer.from(arrayify(keccak256(pairAddress)).slice(0, 4)).readUInt32BE(0)
}

export async function checkPairCollision(contract: TwapFactory, params: { name: string; tokens: string[] }) {
  const bytecode = TwapPair__factory.bytecode
  const pairLength = await contract.allPairsLength()
  const allPairAddresses = await Promise.all(
    [...Array(pairLength.toNumber()).keys()].map((index) => contract.allPairs(index))
  )
  const allPairIds = new Set(allPairAddresses.map((pairAddress) => getPairId(pairAddress)))
  const pairId = getPairId(getPairAddress(contract.address, params.tokens[0], params.tokens[1], bytecode))
  if (allPairIds.has(pairId)) {
    throw new Error(`A pair id collision exists for ${params.name}`)
  }
}
