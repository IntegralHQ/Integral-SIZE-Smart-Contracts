import { BigNumber, constants, Contract, providers, utils, Wallet, BigNumberish } from 'ethers'
import { IERC20, DelayTest } from '../../../build/types'
import { DELAY, expandTo18Decimals, MAX_UINT_32, overrides } from '../utilities'
import { getBuyOrderData } from './'

export const getDefaultBuy = (tokenIn: IERC20, tokenOut: IERC20, wallet: Wallet | Contract) => ({
  gasLimit: 550000,
  gasPrice: utils.parseUnits('100', 'gwei') as BigNumberish,
  etherAmount: expandTo18Decimals(0),
  wrapUnwrap: false,
  to: wallet.address,
  tokenIn: tokenIn.address,
  tokenOut: tokenOut.address,
  amountInMax: expandTo18Decimals(1),
  amountOut: expandTo18Decimals(1),
  submitDeadline: MAX_UINT_32,
})

export const getDefaultLimitOrderBuy = (tokenIn: IERC20, tokenOut: IERC20, wallet: Wallet | Contract) => ({
  gasLimit: 550000,
  gasPrice: utils.parseUnits('100', 'gwei') as BigNumberish,
  etherAmount: expandTo18Decimals(0),
  wrapUnwrap: false,
  to: wallet.address,
  tokenIn: tokenIn.address,
  tokenOut: tokenOut.address,
  amountInMax: expandTo18Decimals(1),
  amountOut: expandTo18Decimals(1),
  submitDeadline: 100,
})

type BuyOverrides = Partial<ReturnType<typeof getDefaultBuy>>

export async function buy(
  delay: DelayTest,
  tokenIn: IERC20,
  tokenOut: IERC20,
  to: Wallet | Contract,
  buyOverrides?: BuyOverrides
) {
  const buyRequest = {
    ...getDefaultBuy(tokenIn, tokenOut, to),
    ...buyOverrides,
  }
  await delay.setGasPrice(buyRequest.gasPrice, overrides)
  await tokenIn.approve(delay.address, constants.MaxUint256, overrides)
  const tx = await delay.buy(buyRequest, {
    ...overrides,
    value: BigNumber.from(buyRequest.gasLimit).mul(buyRequest.gasPrice).add(buyRequest.etherAmount),
  })

  const receipt = await tx.wait()
  const orderData = getBuyOrderData(receipt)
  return { ...buyRequest, orderData, tx }
}

export async function buyAndWait(
  delay: DelayTest,
  tokenIn: IERC20,
  tokenOut: IERC20,
  to: Wallet | Contract,
  buyOverrides?: BuyOverrides
) {
  const buyRequest = await buy(delay, tokenIn, tokenOut, to, buyOverrides)
  await (delay.provider as providers.JsonRpcProvider).send('evm_increaseTime', [DELAY + 1])
  return buyRequest
}
