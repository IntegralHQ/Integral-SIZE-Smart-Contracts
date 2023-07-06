import { Wallet } from 'ethers'
import {
  CustomERC20__factory,
  IntegralToken__factory,
  TwapLPTokenRewarderL1__factory,
  TwapLPTokenRewarderL2__factory,
} from '../../../build/types'
import { expandToDecimals, overrides } from '../utilities'

export async function lpTokenRewarderL1WithOnePoolFixture([wallet]: Wallet[]) {
  const rewardToken = await new IntegralToken__factory(wallet).deploy(
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

  await lpTokenRewarder.setItgrPerSecond(1000000000000000, false)
  await lpTokenRewarder.addPool(lpToken.address, 100, true)

  return { lpTokenRewarder, rewardToken, lpToken }
}

export async function lpTokenRewarderL2WithOnePoolFixture([wallet]: Wallet[]) {
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

  await lpTokenRewarder.setItgrPerSecond(1000000000000000, false)
  await lpTokenRewarder.addPool(lpToken.address, 100, true)

  return { lpTokenRewarder, rewardToken, lpToken }
}
