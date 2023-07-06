import { Wallet } from 'ethers'
import {
  CustomERC20__factory,
  TwapLPTokenRewarderL1__factory,
  TwapLPTokenRewarderL2__factory,
} from '../../../build/types'
import { expandToDecimals, overrides } from '../utilities'

export async function lpTokenRewarderL1Fixture([wallet]: Wallet[]) {
  const rewardToken = await new CustomERC20__factory(wallet).deploy(
    'Reward Token',
    'RTKN',
    18,
    expandToDecimals(10000000, 18),
    overrides
  )
  const lpTokenRewarder = await new TwapLPTokenRewarderL1__factory(wallet).deploy(rewardToken.address, overrides)

  const lpToken = await new CustomERC20__factory(wallet).deploy(
    'LP Token',
    'LPTKN',
    18,
    expandToDecimals(10000000, 18),
    overrides
  )

  const otherLpToken = await new CustomERC20__factory(wallet).deploy(
    'Other LP Token',
    'OLPTKN',
    18,
    expandToDecimals(10000000, 18),
    overrides
  )

  return { lpTokenRewarder, rewardToken, lpToken, otherLpToken }
}

export async function lpTokenRewarderL2Fixture([wallet]: Wallet[]) {
  const rewardToken = await new CustomERC20__factory(wallet).deploy(
    'Reward Token',
    'RTKN',
    18,
    expandToDecimals(10000000, 18),
    overrides
  )
  const lpTokenRewarder = await new TwapLPTokenRewarderL2__factory(wallet).deploy(rewardToken.address, overrides)

  const lpToken = await new CustomERC20__factory(wallet).deploy(
    'LP Token',
    'LPTKN',
    18,
    expandToDecimals(10000000, 18),
    overrides
  )

  const otherLpToken = await new CustomERC20__factory(wallet).deploy(
    'Other LP Token',
    'OLPTKN',
    18,
    expandToDecimals(10000000, 18),
    overrides
  )

  return { lpTokenRewarder, rewardToken, lpToken, otherLpToken }
}
