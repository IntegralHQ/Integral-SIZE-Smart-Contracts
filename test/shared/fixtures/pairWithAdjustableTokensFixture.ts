import { Wallet } from 'ethers'
import { AdjustableERC20__factory } from '../../../build/types'
import { overrides } from '../utilities'
import { deployPairForTokens } from './helpers'
import { factoryFixture } from './factoryFixture'
import { oracleFixture } from './oracleFixture'

export async function pairWithAdjustableTokensFixture([wallet]: Wallet[]) {
  const { oracle } = await oracleFixture([wallet])
  const { factory } = await factoryFixture([wallet])
  const tokenA = await new AdjustableERC20__factory(wallet).deploy(0, overrides)
  const tokenB = await new AdjustableERC20__factory(wallet).deploy(0, overrides)
  const pair = await deployPairForTokens(wallet, oracle.address, factory, tokenA, tokenB, wallet.address)
  const token0Address = await pair.pair.token0()
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA
  return { ...pair, oracle, token0, token1 }
}
