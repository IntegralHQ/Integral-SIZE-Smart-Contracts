import { BigNumber, BigNumberish, constants, utils, Wallet } from 'ethers'
import { AdjustableERC20__factory, TokenSharesTest__factory, WETH9__factory } from '../../../build/types'
import { expandTo18Decimals, overrides } from '../utilities'
import { deployLibraries } from './helpers'

export async function tokenSharesFixture([wallet]: Wallet[]) {
  const weth = await new WETH9__factory(wallet).deploy(overrides)
  const { orders, tokenShares } = await deployLibraries(wallet)
  const tokenSharesTest = await new TokenSharesTest__factory(
    { 'contracts/libraries/TokenShares.sol:TokenShares': tokenShares.address },
    wallet
  ).deploy(weth.address, overrides)
  const adjustableErc20 = await new AdjustableERC20__factory(wallet).deploy(expandTo18Decimals(1000), overrides)

  await adjustableErc20.approve(tokenSharesTest.address, constants.MaxUint256, overrides)
  await weth.deposit({ value: utils.parseEther('1') })
  await weth.approve(tokenSharesTest.address, constants.MaxUint256, overrides)

  async function amountToShares(token: string, amount: BigNumberish) {
    return _amountToShares(token, amount, false, 0)
  }

  async function wethToShares(token: string, amount: BigNumberish, value: BigNumberish) {
    return _amountToShares(token, amount, true, value)
  }

  async function _amountToShares(token: string, amount: BigNumberish, wrap: boolean, value: BigNumberish) {
    const tx = await tokenSharesTest.amountToShares(token, amount, wrap, { ...overrides, value })
    const receipt = await tx.wait()
    const result = tokenSharesTest.interface.parseLog(receipt.logs[receipt.logs.length - 1])
    return result.args[0] as BigNumber
  }

  async function sharesToAmount(token: string, share: BigNumberish, amountLimit?: BigNumberish, refundTo?: string) {
    const tx = await tokenSharesTest.sharesToAmount(
      token,
      share,
      amountLimit ?? 0,
      refundTo ?? constants.AddressZero,
      overrides
    )
    const receipt = await tx.wait()
    const result = tokenSharesTest.interface.parseLog(receipt.logs[receipt.logs.length - 1])
    return result.args[0] as BigNumber
  }

  return { tokenShares: tokenSharesTest, adjustableErc20, weth, amountToShares, wethToShares, sharesToAmount, orders }
}
