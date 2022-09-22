import { BigNumberish, constants, ContractFactory, Wallet } from 'ethers'
import { IUniswapV3Factory, IWETH, IERC20 } from '../../../build/types'
import SwapRouter from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'

import { overrides } from '../utilities'
import { encodePath, FeeAmount } from '../uniswapV3Utilities'

interface SwapParams {
  recipient: string
  amountIn: BigNumberish
  amountOutMinimum: BigNumberish
  tokenIn: IERC20
  tokenOut: IERC20
  fee: FeeAmount
}

export async function deployUniswapV3SwapRouter(factory: IUniswapV3Factory, weth: IWETH, wallet: Wallet) {
  const swapRouter = await new ContractFactory(SwapRouter.abi, SwapRouter.bytecode, wallet).deploy(
    factory.address,
    weth.address
  )

  async function swapOnUniswap({ recipient, amountIn, amountOutMinimum, tokenIn, tokenOut, fee }: SwapParams) {
    await swapRouter.exactInput(
      {
        recipient,
        deadline: constants.MaxUint256,
        amountIn,
        amountOutMinimum,
        path: encodePath([tokenIn.address, tokenOut.address], [fee]),
      },
      overrides
    )
  }

  return { swapRouter, swapOnUniswap }
}
