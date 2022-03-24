import { constants, Contract, providers, utils, Wallet, BigNumberish, BigNumber } from 'ethers'
import { IERC20, DelayTest } from '../../../build/types'
import { DELAY, expandTo18Decimals, MAX_UINT_32, overrides } from '../utilities'

export function getDefaultWithdraw(token0: IERC20, token1: IERC20, to: Wallet | Contract) {
  return {
    gasLimit: 450000,
    gasPrice: utils.parseUnits('100', 'gwei') as BigNumberish,
    token0: token0.address,
    token1: token1.address,
    liquidity: expandTo18Decimals(1),
    amount0Min: expandTo18Decimals(0.5),
    amount1Min: expandTo18Decimals(0.5),
    unwrap: false,
    to: to.address,
    submitDeadline: MAX_UINT_32,
  }
}

type WithdrawOverrides = Partial<ReturnType<typeof getDefaultWithdraw>>

export async function withdraw(
  delay: DelayTest,
  pair: IERC20,
  token0: IERC20,
  token1: IERC20,
  to: Wallet | Contract,
  withdrawOverrides?: WithdrawOverrides
) {
  const withdrawRequest = {
    ...getDefaultWithdraw(token0, token1, to),
    ...withdrawOverrides,
  }
  await delay.setGasPrice(withdrawRequest.gasPrice, overrides)
  await pair.approve(delay.address, constants.MaxUint256, overrides)
  const tx = await delay.withdraw(withdrawRequest, {
    ...overrides,
    value: BigNumber.from(withdrawRequest.gasLimit).mul(withdrawRequest.gasPrice),
  })
  return { ...withdrawRequest, tx }
}

export async function withdrawAndWait(
  delay: DelayTest,
  pair: IERC20,
  token0: IERC20,
  token1: IERC20,
  to: Wallet | Contract,
  withdrawOverrides?: WithdrawOverrides
) {
  const withdrawRequest = await withdraw(delay, pair, token0, token1, to, withdrawOverrides)
  await (delay.provider as providers.JsonRpcProvider).send('evm_increaseTime', [DELAY + 1])
  return withdrawRequest
}
