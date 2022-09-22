import { waffle } from 'hardhat'
import { BigNumber, constants, Wallet } from 'ethers'
import {
  CustomERC20__factory,
  IUniswapV3Factory__factory,
  IUniswapV3Pool__factory,
  UniswapV3Minter__factory,
  WETH9__factory,
} from '../../../build/types'
import { expandToDecimals, overrides } from '../utilities'
import UniswapV3Factory from '../../uniswap/UniswapV3Factory.json'
import {
  FeeAmount,
  getLiquidityForAmounts,
  getMaxTick,
  getMinTick,
  getSqrtPriceX96,
  getSqrtRatioAtTick,
} from '../uniswapV3Utilities'
import { deployUniswapV3SwapRouter } from './deployUniswapV3Router'

const DEFAULT_UNISWAP_V3_FEE = FeeAmount.LOW

export function getUniswapV3PairFixtureFor(xDecimals: number, yDecimals: number) {
  return async function ([wallet]: Wallet[]) {
    const tokenA = await new CustomERC20__factory(wallet).deploy(
      'Token',
      'TKN',
      xDecimals,
      expandToDecimals(10000000, xDecimals),
      overrides
    )
    const tokenB = await new CustomERC20__factory(wallet).deploy(
      'Token',
      'TKN',
      yDecimals,
      expandToDecimals(10000000, yDecimals),
      overrides
    )
    const weth9 = await new WETH9__factory(wallet).deploy(overrides)
    const minter = await new UniswapV3Minter__factory(wallet).deploy(overrides)
    const factoryAsContract = await waffle.deployContract(wallet, UniswapV3Factory, [])
    const factory = IUniswapV3Factory__factory.connect(factoryAsContract.address, wallet)
    await factory.createPool(tokenA.address, tokenB.address, DEFAULT_UNISWAP_V3_FEE, overrides)
    const pairAddress = await factory.getPool(tokenA.address, tokenB.address, DEFAULT_UNISWAP_V3_FEE, overrides)
    const pool = IUniswapV3Pool__factory.connect(pairAddress, wallet)
    const [token0, token1] = tokenA.address === (await pool.token0()) ? [tokenA, tokenB] : [tokenB, tokenA]
    await token0.approve(minter.address, constants.MaxUint256, overrides)
    await token1.approve(minter.address, constants.MaxUint256, overrides)

    const router = await deployUniswapV3SwapRouter(factory, weth9, wallet)
    await token0.approve(router.swapRouter.address, constants.MaxUint256, overrides)
    await token1.approve(router.swapRouter.address, constants.MaxUint256, overrides)

    async function initializePrice(token0Amount: BigNumber, token1Amount: BigNumber) {
      const sqrtPriceX96 = getSqrtPriceX96(token0Amount, token1Amount)
      await pool.initialize(sqrtPriceX96, overrides)
    }

    async function addLiquidity(token0Amount: BigNumber, token1Amount: BigNumber, tickRange?: [number, number]) {
      const tickSpacing = await pool.tickSpacing()
      const tickLower = tickRange ? tickRange[0] : getMinTick(tickSpacing)
      const tickUpper = tickRange ? tickRange[1] : getMaxTick(tickSpacing)

      const { sqrtPriceX96 } = await pool.slot0()
      const liquidity = await getLiquidityForAmounts(
        sqrtPriceX96,
        getSqrtRatioAtTick(tickLower),
        getSqrtRatioAtTick(tickUpper),
        token0Amount,
        token1Amount
      )

      return await minter.mint(
        {
          pool: pool.address,
          recipient: wallet.address,
          tickLower,
          tickUpper,
          liquidity,
        },
        overrides
      )
    }

    return { pool, token0, token1, weth9, factory, initializePrice, addLiquidity, router }
  }
}
