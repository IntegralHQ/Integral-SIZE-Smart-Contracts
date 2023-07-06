import { constants, Contract, utils, Wallet } from 'ethers'
import { IERC20, TwapRelayerTest__factory, TwapRelayerProxyTest__factory } from '../../../build/types'
import { expandTo18Decimals, expandToDecimals, MAX_UINT_32, overrides } from '../utilities'
import { delayOracleV3Fixture } from './delayFixture'

const PRECISION = utils.parseUnits('1')

export const getDefaultRelayerBuy = (tokenIn: IERC20, tokenOut: IERC20, wallet: Wallet | Contract) => ({
  tokenIn: tokenIn.address,
  tokenOut: tokenOut.address,
  amountInMax: expandTo18Decimals(2),
  amountOut: expandTo18Decimals(1),
  wrapUnwrap: false,
  to: wallet.address,
  submitDeadline: MAX_UINT_32,

  //   gasPrice: utils.parseUnits('100', 'gwei') as BigNumberish,
  //   etherAmount: expandTo18Decimals(0),
})

export const getDefaultRelayerSell = (tokenIn: IERC20, tokenOut: IERC20, wallet: Wallet | Contract) => ({
  tokenIn: tokenIn.address,
  tokenOut: tokenOut.address,
  amountIn: expandTo18Decimals(1),
  amountOutMin: expandTo18Decimals(0),
  wrapUnwrap: false,
  to: wallet.address,
  submitDeadline: MAX_UINT_32,

  //   gasPrice: utils.parseUnits('100', 'gwei') as BigNumberish,
  //   etherAmount: expandTo18Decimals(0),
})

export async function relayerFixture(wallets: Wallet[]) {
  const [wallet] = wallets

  const {
    factory,
    delay,
    weth,
    token,
    token6decimals,
    wethPair,
    wethPair6decimals,
    pair,
    oracle,
    addLiquidityETH,
    uniswapPool,
    router,
    token0,
    token1,
    createObservations,
    getState6decimals,
    libraries,
  } = await delayOracleV3Fixture(wallets)

  const relayerImplementation = await new TwapRelayerTest__factory(wallet).deploy(overrides)
  const relayerImplementation2 = await new TwapRelayerTest__factory(wallet).deploy(overrides)

  const relayerProxy = await new TwapRelayerProxyTest__factory(wallet).deploy(relayerImplementation.address, overrides)

  const relayerProxyAsRelayer = TwapRelayerTest__factory.connect(relayerProxy.address, wallet)

  await relayerProxyAsRelayer.initialize(factory.address, delay.address, weth.address, overrides)

  await relayerProxyAsRelayer.approve(token0.address, constants.MaxUint256, delay.address)
  await relayerProxyAsRelayer.approve(token1.address, constants.MaxUint256, delay.address)
  await relayerProxyAsRelayer.approve(token.address, constants.MaxUint256, delay.address)
  await relayerProxyAsRelayer.approve(token6decimals.address, constants.MaxUint256, delay.address)
  await relayerProxyAsRelayer.approve(weth.address, constants.MaxUint256, delay.address)

  const configureForSwapping = async (
    skipPairEnabled = false,
    skipTwapInterval = false,
    skipGasLimit = false,
    skipMultiplier = false,
    skipTokenLimits = false,
    contract = relayerProxyAsRelayer
  ) => {
    if (!skipPairEnabled) {
      await contract.setPairEnabled(pair.address, true, overrides)
      await contract.setPairEnabled(wethPair.address, true, overrides)
      await contract.setPairEnabled(wethPair6decimals.address, true, overrides)
    }
    if (!skipTwapInterval) {
      await contract.setTwapInterval(pair.address, 1, overrides)
      await contract.setTwapInterval(wethPair.address, 1, overrides)
      await contract.setTwapInterval(wethPair6decimals.address, 1, overrides)
    }
    if (!skipGasLimit) {
      await contract.setExecutionGasLimit(550000, overrides)
    }
    if (!skipMultiplier) {
      await contract.setGasPriceMultiplier(expandTo18Decimals(1.05), overrides)
    }
    if (!skipTokenLimits) {
      await contract.setTokenLimitMin(weth.address, expandToDecimals(0.000001, await weth.decimals()))
      await contract.setTokenLimitMaxMultiplier(weth.address, expandTo18Decimals(0.8))
      await contract.setTokenLimitMin(token.address, expandToDecimals(0.000001, await token.decimals()))
      await contract.setTokenLimitMaxMultiplier(token.address, expandTo18Decimals(0.8))
      await contract.setTokenLimitMin(
        token6decimals.address,
        expandToDecimals(0.000001, await token6decimals.decimals())
      )
      await contract.setTokenLimitMaxMultiplier(token6decimals.address, expandTo18Decimals(0.8))
    }

    await wallet.sendTransaction({ to: contract.address, value: expandTo18Decimals(1) })

    await token0.transfer(contract.address, expandTo18Decimals(100), overrides)
    await token0.approve(contract.address, constants.MaxUint256, overrides)

    await token1.transfer(contract.address, expandTo18Decimals(100), overrides)
    await token1.approve(contract.address, constants.MaxUint256, overrides)

    await token.transfer(contract.address, expandTo18Decimals(100), overrides)
    await token.approve(contract.address, constants.MaxUint256, overrides)

    await token6decimals.transfer(
      contract.address,
      expandToDecimals(100000, await token6decimals.decimals()),
      overrides
    )
    await token6decimals.approve(contract.address, constants.MaxUint256, overrides)

    await weth.deposit({ value: expandTo18Decimals(200), ...overrides })
    await weth.transfer(contract.address, expandTo18Decimals(150), overrides)
    await weth.approve(contract.address, constants.MaxUint256, overrides)
  }

  return {
    factory,
    delay,
    relayer: relayerProxyAsRelayer,
    relayerProxy,
    relayerImplementation,
    relayerImplementation2,
    weth,
    token,
    token6decimals,
    wethPair,
    wethPair6decimals,
    pair,
    oracle,
    addLiquidityETH,
    uniswapPool,
    router,
    PRECISION,
    token0,
    token1,
    createObservations,
    configureForSwapping,
    getState6decimals,
    libraries,
  }
}
