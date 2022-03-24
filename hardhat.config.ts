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
    ropsten: {
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 60 * 30 * 1000,
      url: "https://ropsten.infura.io/v3/" + process.env.INFURA_API_KEY,
      gas: 5000000,
    },
    kovan: {
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 60 * 30 * 1000,
      url: "https://kovan.infura.io/v3/" + process.env.INFURA_API_KEY,
      gas: 5000000,
    },
    rinkeby: {
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 60 * 30 * 1000,
      url: "https://rinkeby.infura.io/v3/" + process.env.INFURA_API_KEY,
      gas: 5000000,
    },
    mainnet: {
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 60 * 30 * 1000,
      url: "https://mainnet.infura.io/v3/" + process.env.INFURA_API_KEY,
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
    apiKey: 'xxx'
  }
}
