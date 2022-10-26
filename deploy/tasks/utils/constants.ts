import { Network } from '../../shared/wallet'

type Tokens = { [key in Network]: { [symbol: string]: string | undefined } }

export const KNOWN_TOKENS: Tokens = {
  'arbitrum-goerli': {
    wbtc: undefined,
    usdc: undefined,
    usdt: undefined,
    dai: undefined,
    weth: '0xe39Ab88f8A4777030A534146A9Ca3B52bd5D43A3',
    crv: undefined,
    cvx: undefined,
    sushi: undefined,
    steth: undefined,
    matic: undefined,
  },
  arbitrum: {
    wbtc: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    usdc: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    usdt: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    dai: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    crv: '0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978',
    cvx: undefined,
    sushi: '0xd4d42F0b6DEF4CE0383636770eF773390d85c61A',
    steth: '', // Unknown
    matic: '', // Unknown
  },
  ganache: {
    wbtc: '0xA193E42526F1FEA8C99AF609dcEabf30C1c29fAA',
    usdc: '0xFDFEF9D10d929cB3905C71400ce6be1990EA0F34',
    usdt: '0xaC8444e7d45c34110B34Ed269AD86248884E78C7',
    dai: '0x94BA4d5Ebb0e05A50e977FFbF6e1a1Ee3D89299c',
    weth: '0xFf807885934003A35b1284d7445fc83Fd23417e5',
    crv: undefined,
    cvx: undefined,
    sushi: undefined,
    steth: undefined,
    matic: undefined,
  },
  goerli: {
    wbtc: undefined,
    usdc: undefined,
    usdt: undefined,
    dai: undefined,
    weth: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
    crv: undefined,
    cvx: undefined,
    sushi: undefined,
    steth: undefined,
    matic: undefined,
  },
  kovan: {
    wbtc: undefined,
    usdc: undefined,
    usdt: undefined,
    dai: undefined,
    weth: '0xd0A1E359811322d97991E03f863a0C30C2cF029C',
    crv: undefined,
    cvx: undefined,
    sushi: undefined,
    steth: undefined,
    matic: undefined,
  },
  ropsten: {
    wbtc: '0x2d80502854fc7304c3e3457084de549f5016b73f',
    usdc: '0x0d9c8723b343a8368bebe0b5e89273ff8d712e3c',
    usdt: undefined,
    dai: '0xad6d458402f60fd3bd25163575031acdce07538d',
    weth: '0xc778417e063141139fce010982780140aa0cd5ab',
    crv: undefined,
    cvx: undefined,
    sushi: undefined,
    steth: undefined,
    matic: undefined,
  },
  rinkeby: {
    wbtc: undefined,
    usdc: undefined,
    usdt: undefined,
    dai: undefined,
    weth: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
    crv: undefined,
    cvx: undefined,
    sushi: undefined,
    steth: undefined,
    matic: undefined,
  },
  mainnet: {
    wbtc: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    usdt: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    dai: '0x6b175474e89094c44da98b954eedeac495271d0f',
    weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    link: '0x514910771af9ca656af840dff83e8264ecf986ca',
    crv: '0xD533a949740bb3306d119CC777fa900bA034cd52',
    cvx: '0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B',
    sushi: '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2',
    steth: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    matic: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
  },
}

// https://github.com/makerdao/multicall
export const KNOWN_MULTICALL = {
  mainnet: '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
  kovan: '0x2cc8688c5f75e365aaeeb4ea8d6a480405a48d2a',
  ropsten: '0x53c43764255c17bd724f74c4ef150724ac50a3ed',
  rinkeby: '0x42ad527de7d4e9d9d011ac45b31d8551f8fe9821',
  ganache: '0xBCa5c1cBc034C0AF31D976a4e3a36951A537eD77',
  goerli: undefined,
  arbitrum: undefined,
  'arbitrum-goerli': undefined,
}

export const UNISWAP_V2_FACTORY = {
  mainnet: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  kovan: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  ropsten: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  rinkeby: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  ganache: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  goerli: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  arbitrum: '',
  'arbitrum-goerli': undefined,
}

export const UNISWAP_V3_FACTORY = {
  mainnet: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  kovan: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  ropsten: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  rinkeby: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  ganache: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  goerli: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  arbitrum: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  'arbitrum-goerli': undefined,
}

// https://github.com/Uniswap/uniswap-v3-periphery/blob/767e779227a4f10fc7f4b4d90b103e9dfd252677/testnet-deploys.md
export const UNISWAP_V3_NON_FUNGIBLE_POSITION_MANAGER = {
  mainnet: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  kovan: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  ropsten: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  rinkeby: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  ganache: '',
  goerli: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  arbitrum: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  'arbitrum-goerli': undefined,
}

export const SUSHISWAP_V2_FACTORY = {
  mainnet: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
  kovan: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
  ropsten: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
  rinkeby: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
  ganache: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
  goerli: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
  arbitrum: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
  'arbitrum-goerli': undefined,
}
