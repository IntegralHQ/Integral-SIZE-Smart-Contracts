require('dotenv').config()
import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-waffle"
import "@nomiclabs/hardhat-etherscan"
import "hardhat-gas-reporter"
import "hardhat-abi-exporter"
import "@typechain/hardhat"

export default {
  defaultNetwork: process.env.DEFAULT_NETWORK,
  gasReporter: {
    showTimeSpent: true,
    currency: 'USD',
  },
  networks: {
    ganache: {
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 60 * 30 * 1000,
      url: "127.0.0.1:8545",
      gas: 5000000,
    },
    polygon: {
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 60 * 30 * 1000,
      url: "https://polygon-mainnet.infura.io/v3/" + (process.env.INFURA_API_KEY),
      gas: 5000000,
    },
    'polygon-mumbai': {
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 60 * 30 * 1000,
      url: "https://polygon-mumbai.infura.io/v3/" + (process.env.INFURA_API_KEY),
      gas: 5000000,
    },
    optimism: {
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 60 * 30 * 1000,
      url: "https://optimism-mainnet.infura.io/v3/" + (process.env.INFURA_API_KEY),
      gas: 5000000,
    },
    'optimism-goerli': {
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 60 * 30 * 1000,
      url: "https://optimism-goerli.infura.io/v3/" + (process.env.INFURA_API_KEY),
      gas: 5000000,
    },
    'arbitrum': {
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 60 * 30 * 1000,
      // url: 'https://arb1.arbitrum.io/rpc',
      url: "https://arbitrum-mainnet.infura.io/v3/" + (process.env.INFURA_API_KEY),
      gas: 5000000,
    },
    'arbitrum-goerli': {
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 60 * 30 * 1000,
      // url: 'https://goerli-rollup.arbitrum.io/rpc',
      url: "https://arbitrum-goerli.infura.io/v3/" + (process.env.INFURA_API_KEY),
      gas: 5000000,
    },
    goerli: {
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 60 * 30 * 1000,
      url: "https://goerli.infura.io/v3/" + (process.env.INFURA_API_KEY),
      gas: 5000000,
    },
    sepolia: {
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 60 * 30 * 1000,
      url: "https://sepolia.infura.io/v3/" + (process.env.INFURA_API_KEY),
      gas: 5000000,
    },
    ropsten: {
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 60 * 30 * 1000,
      url: "https://ropsten.infura.io/v3/" + (process.env.INFURA_API_KEY),
      gas: 5000000,
    },
    kovan: {
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 60 * 30 * 1000,
      url: "https://kovan.infura.io/v3/" + (process.env.INFURA_API_KEY),
      gas: 5000000,
    },
    rinkeby: {
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 60 * 30 * 1000,
      url: "https://rinkeby.infura.io/v3/" + (process.env.INFURA_API_KEY),
      gas: 5000000,
    },
    mainnet: {
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 60 * 30 * 1000,
      url: "https://mainnet.infura.io/v3/" + (process.env.INFURA_API_KEY),
      gas: 5000000,
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.7.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
        },
      },
    ],
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './build/artifacts',
  },
  abiExporter: {
    path: './build/abi',
    clear: true,
    flat: true,
    spacing: 2,
  },
  typechain: {
    outDir: './build/types',
    target: 'ethers-v5',
  },
  etherscan: {
    apiKey: {
      mainnet: '[API KEY]',
      goerli: '[API KEY]',
      sepolia: '[API KEY]',
      arbitrum: '[API KEY]',
      'arbitrum-goerli': '[API KEY]',
      polygon: '[API KEY]',
      polygonMumbai: '[API KEY]',
      optimisticEthereum: '[API KEY]',
      'optimism-goerli': '[API KEY]',
    },
    customChains: [
      {
        network: "arbitrum",
        chainId: 42161,
        urls: {
          apiURL: "https://api.arbiscan.io/api",
          browserURL: "https://arbiscan.io"
        }
      },
      {
        network: "arbitrum-goerli",
        chainId: 421613,
        urls: {
          apiURL: "https://api-goerli.arbiscan.io/api",
          browserURL: "https://goerli.arbiscan.io"
        }
      },
      {
        network: "optimism-goerli",
        chainId: 420,
        urls: {
          apiURL: "https://api-goerli-optimism.etherscan.io/api",
          browserURL: "https://goerli-optimism.etherscan.io/",
        },
      },
    ]
  }
}
