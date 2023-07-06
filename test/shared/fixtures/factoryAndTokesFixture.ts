import { Wallet } from 'ethers'
import { ERC20__factory } from '../../../build/types'
import { expandTo18Decimals, overrides } from '../utilities'
import { factoryFixture } from './factoryFixture'

export async function factoryAndTokesFixture([wallet]: Wallet[]) {
  const { factory } = await factoryFixture([wallet])
  const token0 = await new ERC20__factory(wallet).deploy(expandTo18Decimals(10000000), overrides)
  const token1 = await new ERC20__factory(wallet).deploy(expandTo18Decimals(10000000), overrides)

  return { factory, token0, token1 }
}
