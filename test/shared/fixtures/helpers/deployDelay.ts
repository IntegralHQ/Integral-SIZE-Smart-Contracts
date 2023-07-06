import { constants, Wallet } from 'ethers'
import { DelayTest__factory, TwapFactory, TwapLimitOrderTest__factory, WETH9 } from '../../../../build/types'
import { overrides } from '../../utilities'
import { deployLibraries } from './deployLibraries'

export async function deployDelay(wallet: Wallet, factory: TwapFactory, weth: WETH9) {
  const delayLibraries = await deployLibraries(wallet)
  const delay = await new DelayTest__factory(delayLibraries.libraries, wallet).deploy(
    factory.address,
    weth.address,
    constants.AddressZero,
    overrides
  )
  const limitOrderLibraries = await deployLibraries(wallet)
  const limitOrder = await new TwapLimitOrderTest__factory(limitOrderLibraries.libraries, wallet).deploy(
    delay.address,
    factory.address,
    weth.address,
    wallet.address,
    overrides
  )
  return { delay, limitOrder, ...delayLibraries }
}
