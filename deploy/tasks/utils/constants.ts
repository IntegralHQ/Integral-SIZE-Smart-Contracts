import { Network } from '../../shared/wallet'

type Tokens = { [key in Network]: { [symbol: string]: string | undefined } }

export const KNOWN_TOKENS: Tokens = {
  ganache: {
    wbtc: '0xA193E42526F1FEA8C99AF609dcEabf30C1c29fAA',
    usdc: '0xFDFEF9D10d929cB3905C71400ce6be1990EA0F34',
    usdt: '0xaC8444e7d45c34110B34Ed269AD86248884E78C7',
    dai: '0x94BA4d5Ebb0e05A50e977FFbF6e1a1Ee3D89299c',
    weth: '0xFf807885934003A35b1284d7445fc83Fd23417e5',
  },
  kovan: {
    wbtc: undefined,
    usdc: undefined,
    usdt: undefined,
    dai: undefined,
    weth: '0xd0A1E359811322d97991E03f863a0C30C2cF029C',
    crv: undefined,
  },
  ropsten: {
    wbtc: '0x2d80502854fc7304c3e3457084de549f5016b73f',
    usdc: '0x0d9c8723b343a8368bebe0b5e89273ff8d712e3c',
    usdt: undefined,
    dai: '0xad6d458402f60fd3bd25163575031acdce07538d',
    weth: '0xc778417e063141139fce010982780140aa0cd5ab',
  },
  rinkeby: {
    wbtc: undefined,
    usdc: undefined,
    usdt: undefined,
    dai: undefined,
    weth: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
    crv: undefined,
  },
  mainnet: {
    wbtc: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    usdt: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    dai: '0x6b175474e89094c44da98b954eedeac495271d0f',
    weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    link: '0x514910771af9ca656af840dff83e8264ecf986ca',
    crv: '0xD533a949740bb3306d119CC777fa900bA034cd52',
  },
}

export const UNISWAP_V2_FACTORY = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'
export const SUSHISWAP_V2_FACTORY = '0xc35DADB65012eC5796536bD9864eD8773aBc74C4'
