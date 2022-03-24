import { Wallet } from 'ethers'
import { AdjustableERC20__factory, ReservesTest__factory } from '../../../build/types'
import { overrides } from '../utilities'

export async function reservesTestFixture([wallet]: Wallet[]) {
  const token0 = await new AdjustableERC20__factory(wallet).deploy(0, overrides)
  const token1 = await new AdjustableERC20__factory(wallet).deploy(0, overrides)
  const reservesTest = await new ReservesTest__factory(wallet).deploy(token0.address, token1.address, overrides)
  async function getState() {
    return {
      fees: await reservesTest.getFees(),
      reserves: await reservesTest.getReserves(),
      reservesToken0Balance: await token0.balanceOf(reservesTest.address),
      reservesToken1Balance: await token1.balanceOf(reservesTest.address),
    }
  }
  return { reservesTest, token0, token1, getState }
}
