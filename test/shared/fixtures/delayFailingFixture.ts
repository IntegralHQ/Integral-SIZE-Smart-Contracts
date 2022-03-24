import { constants, Wallet } from 'ethers'
import { FailingERC20, FailingERC20__factory, DelayTest__factory } from '../../../build/types'
import { expandTo18Decimals, overrides } from '../utilities'
import { factoryFixture } from './factoryFixture'
import { oracleWithUniswapFixture } from './oracleWithUniswapFixture'
import { deployLibraries, deployPairForTokens, setTokenTransferCosts } from './helpers'

export async function delayFailingFixture([wallet]: Wallet[]) {
  const { oracle, pair: uniswapPair, addLiquidity, setUniswapPrice } = await oracleWithUniswapFixture([wallet])
  await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
  await oracle.setUniswapPair(uniswapPair.address)
  await setUniswapPrice(2)
  const { factory } = await factoryFixture([wallet])
  const tokenA = await new FailingERC20__factory(wallet).deploy(expandTo18Decimals(100000), overrides)
  const tokenB = await new FailingERC20__factory(wallet).deploy(expandTo18Decimals(100000), overrides)
  const { libraries, orders, tokenShares } = await deployLibraries(wallet)
  const delay = await new DelayTest__factory(libraries, wallet).deploy(
    factory.address,
    constants.AddressZero,
    constants.AddressZero,
    overrides
  )
  const pair = await deployPairForTokens(wallet, oracle.address, factory, tokenA, tokenB, delay.address)

  const token0 = pair.token0 as FailingERC20
  const token1 = pair.token1 as FailingERC20
  await setTokenTransferCosts(delay, [token0, token1])

  async function deployAnotherPair() {
    const tokenA = await new FailingERC20__factory(wallet).deploy(expandTo18Decimals(100000), overrides)
    const tokenB = await new FailingERC20__factory(wallet).deploy(expandTo18Decimals(100000), overrides)
    const pair = await deployPairForTokens(wallet, oracle.address, factory, tokenA, tokenB, delay.address)
    const token2 = pair.token0 as FailingERC20
    const token3 = pair.token1 as FailingERC20
    await setTokenTransferCosts(delay, [token2, token3])
    return { token2, token3, addAnotherLiquidity: pair.addLiquidity }
  }

  return { delay, ...pair, token0, token1, deployAnotherPair, orders, tokenShares, oracle }
}
