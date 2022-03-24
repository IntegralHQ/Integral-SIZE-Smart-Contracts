import { utils } from 'ethers'

export function decodeErrorData(arg: string) {
  return new utils.Interface(['function Error(string)']).decodeFunctionData('Error', arg)[0]
}

export function encodeErrorData(arg: string) {
  return new utils.Interface(['function Error(string)']).encodeFunctionData('Error', [arg])
}
