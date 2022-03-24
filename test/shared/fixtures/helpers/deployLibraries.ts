import { Wallet, ContractFactory } from 'ethers'
import { deployContract } from 'ethereum-waffle'
import { artifacts } from 'hardhat'
import { Orders__factory, TokenShares__factory } from '../../../../build/types'
import { overrides } from '../../utilities'

export async function deployLibraries(wallet: Wallet) {
  const WithdrawHelper = await artifacts.readArtifact('WithdrawHelper')
  const AddLiquidity = await artifacts.readArtifact('AddLiquidity')
  const withdrawHelper = await deployContract(wallet, WithdrawHelper, [])
  const addLiquidity = await new ContractFactory(AddLiquidity.abi, AddLiquidity.bytecode, wallet).deploy(overrides)
  const tokenShares = await new ContractFactory(TokenShares__factory.abi, TokenShares__factory.bytecode, wallet).deploy(
    overrides
  )
  const orders = await new Orders__factory(
    { 'contracts/libraries/TokenShares.sol:TokenShares': tokenShares.address },
    wallet
  ).deploy()
  return {
    libraries: {
      'contracts/libraries/TokenShares.sol:TokenShares': tokenShares.address,
      'contracts/libraries/Orders.sol:Orders': orders.address,
      'contracts/libraries/AddLiquidity.sol:AddLiquidity': addLiquidity.address,
      'contracts/libraries/WithdrawHelper.sol:WithdrawHelper': withdrawHelper.address,
    },
    orders,
    tokenShares,
  }
}
