import { BigNumber, utils, constants, Wallet, ContractTransaction, Event, providers } from 'ethers'
import { ERC20 } from '../../build/types'

const PERMIT_TYPEHASH = utils.keccak256(
  utils.toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

export const MAX_UINT_256 = BigNumber.from(2).pow(256).sub(1)
export const MAX_UINT_96 = BigNumber.from(2).pow(96).sub(1)
export const MAX_UINT_32 = 2 ** 32 - 1

export const DELAY = 30 * 60 // 30 minutes
export const BOT_EXECUTION_TIME = 20 * 60 // 20 minutes
export const EXPIRATION_UPPER_LIMIT = 24 * 60 * 60 * 90
export const ORDER_LIFESPAN_IN_HOURS = 48

export const MIN_ALLOWED_GAS_LIMIT = 140_000 // Approximately. May need to be updated if SC code changes.

export const INVALID_ADDRESS = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'

export const MAX_CONTRACT_BYTECODE_SIZE = 24_576 // As per EIP-170

export function expandTo18Decimals(n: number | string): BigNumber {
  return expandToDecimals(n, 18)
}

export function expandToDecimals(n: number | string, decimals: number): BigNumber {
  return utils.parseUnits(n.toString(), decimals)
}

export function makeFloatEncodable(n: BigNumber) {
  const hex = n.toHexString()
  if (hex.length <= 8) {
    return n
  } else {
    const cutPrecision = hex.substring(0, 8).concat('0'.repeat(hex.length - 8))
    return BigNumber.from(cutPrecision)
  }
}

export function getDomainSeparator(name: string, tokenAddress: string, chainId: number) {
  return utils.keccak256(
    utils.defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        utils.keccak256(
          utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
        ),
        utils.keccak256(utils.toUtf8Bytes(name)),
        utils.keccak256(utils.toUtf8Bytes('1')),
        chainId,
        tokenAddress,
      ]
    )
  )
}

export function getCreate2Address(
  factoryAddress: string,
  [tokenA, tokenB]: [string, string],
  bytecode: string
): string {
  const [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA]
  const create2Inputs = [
    '0xff',
    factoryAddress,
    utils.keccak256(utils.solidityPack(['address', 'address'], [token0, token1])),
    utils.keccak256(bytecode),
  ]
  const sanitizedInputs = `0x${create2Inputs.map((i) => i.slice(2)).join('')}`
  return utils.getAddress(`0x${utils.keccak256(sanitizedInputs).slice(-40)}`)
}

export async function getApprovalDigest(
  token: ERC20,
  approve: {
    owner: string
    spender: string
    value: BigNumber
  },
  nonce: BigNumber,
  deadline: BigNumber
): Promise<string> {
  const name = await token.name()
  const DOMAIN_SEPARATOR = getDomainSeparator(name, token.address, await token.signer.getChainId())
  return utils.keccak256(
    utils.solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        utils.keccak256(
          utils.defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
            [PERMIT_TYPEHASH, approve.owner, approve.spender, approve.value, nonce, deadline]
          )
        ),
      ]
    )
  )
}

export function signDigest(wallet: Wallet, digest: string) {
  const signingKey = new utils.SigningKey(wallet.privateKey)
  return signingKey.signDigest(digest)
}

export async function mineBlock(wallet: Wallet) {
  return wallet.sendTransaction({ to: constants.AddressZero, value: 1 })
}

export async function mineBlocks(wallet: Wallet, n: number) {
  for (let i = 0; i < n; i++) {
    await mineBlock(wallet)
  }
}

export async function mineBlockRPCMethod(wallet: Wallet) {
  await (wallet.provider as providers.JsonRpcProvider).send('evm_mine', [])
}

export async function increaseTime(wallet: Wallet, seconds?: number) {
  await (wallet.provider as providers.JsonRpcProvider).send('evm_increaseTime', [seconds || 1])
  await mineBlock(wallet)
}

export async function increaseTimeWithoutMining(wallet: Wallet, seconds?: number) {
  await (wallet.provider as providers.JsonRpcProvider).send('evm_increaseTime', [seconds || 1])
}

// Work around an issue where Hardhat Network increases time by 2 seconds, instead of 1, when we call evm_increaseTime.
export async function increaseTimeWithWorkaround(wallet: Wallet, seconds?: number) {
  const currentTimestamp = (await wallet.provider.getBlock('latest')).timestamp
  await (wallet.provider as providers.JsonRpcProvider).send('evm_setNextBlockTimestamp', [
    currentTimestamp + (seconds ? seconds : 1),
  ])
  await mineBlockRPCMethod(wallet)
}

export async function turnOffAutomine(wallet: Wallet) {
  await (wallet.provider as providers.JsonRpcProvider).send('evm_setAutomine', [false])
}

export async function turnOnAutomine(wallet: Wallet) {
  await (wallet.provider as providers.JsonRpcProvider).send('evm_setAutomine', [true])
}

export function getFutureTime() {
  return Date.now() + 1000000
}

export function encodePrice(reserve0: BigNumber, reserve1: BigNumber) {
  return [
    reserve1.mul(BigNumber.from(2).pow(112)).div(reserve0),
    reserve0.mul(BigNumber.from(2).pow(112)).div(reserve1),
  ]
}

export const overrides = {
  gasLimit: 9999999,
}

export function pairAddressToPairId(pairAddress: string) {
  return parseInt(utils.keccak256(pairAddress).slice(2, 10), 16)
}

export async function getEvents(tx: ContractTransaction, eventName: string) {
  return (await tx.wait()).events?.filter((e) => e.event === eventName) ?? []
}

// function for 'OrderExecuted' event
export function getGasSpent(event: Event) {
  return event.args?.[3]
}

// function for 'OrderExecuted' event
export function getEthRefund(event: Event) {
  return event.args?.[4]
}

export async function getTxGasUsed(tx: Promise<providers.TransactionResponse>) {
  const receipt = await (await tx).wait()
  return receipt.gasUsed
}

export async function getCurrentBlockNumber(wallet: Wallet) {
  return await getTxBlockNumber(mineBlock(wallet))
}

export async function getTxBlockNumber(tx: providers.TransactionResponse | Promise<providers.TransactionResponse>) {
  return (await (await tx).wait()).blockNumber
}

export function toDecimals(number: string, decimals: number) {
  const integer = number.split('.')[0]
  const fractions = number.split('.')[1]
  const value = [integer, fractions && fractions.slice(0, decimals)].join('.')
  return utils.parseUnits(value, decimals)
}
