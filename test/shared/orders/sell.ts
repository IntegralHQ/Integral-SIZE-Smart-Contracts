import { BigNumber, constants, Contract, providers, utils, Wallet, BigNumberish } from 'ethers'
import { IERC20, DelayTest } from '../../../build/types'
import { DELAY, expandTo18Decimals, MAX_UINT_32, overrides } from '../utilities'

export const getDefaultSell = (tokenIn: IERC20, tokenOut: IERC20, wallet: Wallet | Contract) => ({
  gasLimit: 400000,
  gasPrice: utils.parseUnits('100', 'gwei') as BigNumberish,
  etherAmount: expandTo18Decimals(0),
  wrapUnwrap: false,
  to: wallet.address,
  tokenIn: tokenIn.address,
  tokenOut: tokenOut.address,
  amountIn: expandTo18Decimals(1),
  amountOutMin: expandTo18Decimals(0),
  submitDeadline: MAX_UINT_32,
})

type SellOverrides = Partial<ReturnType<typeof getDefaultSell>>

export async function sell(
  delay: DelayTest,
  tokenIn: IERC20,
  tokenOut: IERC20,
  to: Wallet | Contract,
  sellOverrides?: SellOverrides
) {
  const sellRequest = {
    ...getDefaultSell(tokenIn, tokenOut, to),
    ...sellOverrides,
  }
  await delay.setGasPrice(sellRequest.gasPrice, overrides)
  await tokenIn.approve(delay.address, constants.MaxUint256, overrides)
  const tx = await delay.sell(sellRequest, {
    ...overrides,
    value: BigNumber.from(sellRequest.gasLimit).mul(sellRequest.gasPrice).add(sellRequest.etherAmount),
  })
  const newestOrderId = await delay.newestOrderId()
  const { priceAccumulator, timestamp } = await delay.getSellOrder(newestOrderId, overrides)
  return { ...sellRequest, priceAccumulator, timestamp, tx }
}

export async function sellAndWait(
  delay: DelayTest,
  tokenIn: IERC20,
  tokenOut: IERC20,
  to: Wallet | Contract,
  sellOverrides?: SellOverrides
) {
  const sellRequest = await sell(delay, tokenIn, tokenOut, to, sellOverrides)
  await (delay.provider as providers.JsonRpcProvider).send('evm_increaseTime', [DELAY + 1])
  return sellRequest
}
