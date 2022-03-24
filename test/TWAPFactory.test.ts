import { expect } from 'chai'
import { Contract, BigNumber, Wallet, constants } from 'ethers'

import { expandTo18Decimals, getCreate2Address, overrides } from './shared/utilities'
import { factoryFixture, oracleFixture, pairFixture } from './shared/fixtures'
import { setupFixtureLoader } from './shared/setup'

import { factoryWithOracleAndTokensFixture } from './shared/fixtures/factoryWithOracleAndTokensFixture'
import { TwapPair__factory } from '../build/types'

const TEST_TRADER = '0x1000000000000000000000000000000000000000'

type FactoryFunction = 'setMintFee' | 'setBurnFee' | 'setSwapFee' | 'setTrader'

describe('TwapFactory', () => {
  const loadFixture = setupFixtureLoader()

  it('sets owner to msg.sender', async () => {
    const { factory, wallet } = await loadFixture(factoryFixture)
    expect(await factory.owner()).to.eq(wallet.address)
  })

  it('sets allPairsLength to 0 initially', async () => {
    const { factory } = await loadFixture(factoryFixture)
    expect(await factory.allPairsLength()).to.eq(0)
  })

  async function createPair(wallet: Wallet, factory: Contract, tokens: [string, string], oracle: string) {
    const sortedTokens = BigNumber.from(tokens[0]).lt(BigNumber.from(tokens[1]))
      ? [tokens[0], tokens[1]]
      : [tokens[1], tokens[0]]
    const bytecode = TwapPair__factory.bytecode
    const create2Address = getCreate2Address(factory.address, tokens, bytecode)
    await expect(factory.createPair(...tokens, oracle, TEST_TRADER, overrides))
      .to.emit(factory, 'PairCreated')
      .withArgs(sortedTokens[0], sortedTokens[1], create2Address, BigNumber.from(1))

    await expect(factory.createPair(...tokens, oracle, TEST_TRADER, overrides)).to.revertedWith('TF18')
    await expect(factory.createPair(...tokens.slice().reverse(), oracle, TEST_TRADER, overrides)).to.revertedWith(
      'TF18'
    )

    expect(await factory.getPair(...tokens)).to.eq(create2Address)
    expect(await factory.getPair(...tokens.slice().reverse())).to.eq(create2Address)
    expect(await factory.allPairs(0)).to.eq(create2Address)
    expect(await factory.allPairsLength()).to.eq(1)

    const pair = new Contract(create2Address, JSON.stringify(TwapPair__factory.abi), wallet)
    expect(await pair.factory()).to.eq(factory.address)
    expect(await pair.token0()).to.eq(sortedTokens[0])
    expect(await pair.token1()).to.eq(sortedTokens[1])
    expect(await pair.oracle()).to.eq(oracle)
  }

  it('can create pairs', async () => {
    const { factory, oracle, token0, token1, wallet } = await loadFixture(factoryWithOracleAndTokensFixture)
    await createPair(wallet, factory, [token0.address, token1.address], oracle.address)
  })

  it('can create pairs when the token addresses are reversed', async () => {
    const { factory, oracle, token0, token1, wallet } = await loadFixture(factoryWithOracleAndTokensFixture)
    await createPair(wallet, factory, [token1.address, token0.address], oracle.address)
  })

  it('performs addresses checkings when creating pair', async () => {
    const { factory, oracle, token0, token1, wallet } = await loadFixture(factoryWithOracleAndTokensFixture)
    await expect(
      factory.createPair(token0.address, token1.address, constants.AddressZero, wallet.address)
    ).to.revertedWith('TP02')
    await expect(
      factory.createPair(token0.address, constants.AddressZero, oracle.address, wallet.address)
    ).to.revertedWith('TF02')
    await expect(
      factory.createPair(constants.AddressZero, token1.address, oracle.address, wallet.address)
    ).to.revertedWith('TF02')
    await expect(factory.createPair(token0.address, token1.address, wallet.address, wallet.address)).to.revertedWith(
      'TP1D'
    )
    await expect(factory.createPair(token0.address, wallet.address, oracle.address, wallet.address)).to.revertedWith(
      'TP10'
    )
    await expect(factory.createPair(wallet.address, token1.address, oracle.address, wallet.address)).to.revertedWith(
      'TP10'
    )
  })

  it('prevents non-owners from creating pairs', async () => {
    const { factory, token0, token1, other, wallet } = await loadFixture(factoryWithOracleAndTokensFixture)
    const { oracle } = await oracleFixture([wallet])
    await expect(
      factory.connect(other).createPair(token0.address, token1.address, oracle.address, TEST_TRADER, overrides)
    ).to.be.revertedWith('TF00')
  })

  it('can change the owner with setOwner', async () => {
    const { factory, wallet, other } = await loadFixture(factoryFixture)
    await expect(factory.connect(other).setOwner(other.address, overrides)).to.be.revertedWith('TF00')
    await expect(factory.setOwner(other.address, overrides)).to.emit(factory, 'OwnerSet').withArgs(other.address)
    expect(await factory.owner()).to.eq(other.address)
    await expect(factory.setOwner(wallet.address, overrides)).to.be.revertedWith('TF00')
  })

  it('performs address checks when setting owner', async () => {
    const { factory, wallet } = await loadFixture(factoryFixture)
    await expect(factory.setOwner(wallet.address, overrides)).to.be.revertedWith('TF01')
    await expect(factory.setOwner(constants.AddressZero, overrides)).to.be.revertedWith('TF02')
  })

  it('owner can withdraw', async () => {
    const { factory, wallet, other, token0, token1, addLiquidity } = await loadFixture(pairFixture)
    await factory.setMintFee(token0.address, token1.address, expandTo18Decimals(0.5), overrides)
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))

    // we set the trader to check that it is ignored when factory is withdrawing
    await factory.setTrader(token0.address, token1.address, constants.AddressZero, overrides)

    const balance0Before = await token0.balanceOf(wallet.address)
    const balance1Before = await token1.balanceOf(wallet.address)

    await expect(
      factory.connect(other).withdraw(token0.address, token1.address, expandTo18Decimals(40), wallet.address, overrides)
    ).to.be.revertedWith('TF00')

    await factory.withdraw(token0.address, token1.address, expandTo18Decimals(40), wallet.address, overrides)

    const balance0After = await token0.balanceOf(wallet.address)
    const balance1After = await token1.balanceOf(wallet.address)

    expect(balance0After.sub(balance0Before)).to.eq(expandTo18Decimals(40))
    expect(balance1After.sub(balance1Before)).to.eq(expandTo18Decimals(40))
  })

  it('owner can collect', async () => {
    const {
      factory,
      wallet,
      other,
      token0,
      token1,
      pair,
      addLiquidity,
      PRECISION,
      setupUniswapPair,
      getEncodedPriceInfo,
    } = await loadFixture(pairFixture)
    await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
    await setupUniswapPair(2)
    const swapFee = expandTo18Decimals(0.5)
    await factory.setSwapFee(token0.address, token1.address, swapFee, overrides)

    const priceInfo = await getEncodedPriceInfo()

    const amount1In = expandTo18Decimals(1)
    const amount0Out = await pair.getSwapAmount0Out(amount1In, priceInfo)

    const feeAmount = amount1In.mul(swapFee).div(PRECISION)

    await token1.transfer(pair.address, amount1In, overrides)
    await pair.swap(amount0Out, 0, wallet.address, priceInfo, overrides)

    const balance0Before = await token0.balanceOf(wallet.address)
    const balance1Before = await token1.balanceOf(wallet.address)

    await expect(
      factory.connect(other).collect(token0.address, token1.address, wallet.address, overrides)
    ).to.be.revertedWith('TF00')

    await factory.collect(token0.address, token1.address, wallet.address, overrides)

    const balance0After = await token0.balanceOf(wallet.address)
    const balance1After = await token1.balanceOf(wallet.address)

    expect(balance0After.sub(balance0Before)).to.eq(0)
    expect(balance1After.sub(balance1Before)).to.eq(feeAmount)
  })

  describe('pair setters', () => {
    const setters: [FactoryFunction, ...string[]][] = [
      ['setMintFee', '2000000'],
      ['setBurnFee', '2000000'],
      ['setSwapFee', '2000000'],
      ['setTrader', Wallet.createRandom().address],
    ]

    for (const [method, param] of setters) {
      it(method, async () => {
        const { factory, oracle, token0, token1, wallet, other } = await loadFixture(factoryWithOracleAndTokensFixture)
        await expect(
          factory.connect(other)[method](token0.address, token1.address, param, overrides)
        ).to.be.revertedWith('TF00')
        await expect(factory[method](token0.address, token1.address, param, overrides)).to.be.revertedWith('TF19')
        await createPair(wallet, factory, [token0.address, token1.address], oracle.address)
        await factory[method](token0.address, token1.address, param, overrides)
      })
    }

    it('setOracle', async () => {
      const { factory, oracle, token0, token1, other, wallet, getAnotherOracle } = await loadFixture(
        factoryWithOracleAndTokensFixture
      )
      await expect(
        factory.connect(other).setOracle(token0.address, token1.address, oracle.address, overrides)
      ).to.be.revertedWith('TF00')
      await expect(factory.setOracle(token0.address, token1.address, oracle.address, overrides)).to.be.revertedWith(
        'TF19'
      )
      await createPair(wallet, factory, [token0.address, token1.address], oracle.address)
      const { otherOracle } = await getAnotherOracle()
      await factory.setOracle(token0.address, token1.address, otherOracle.address, overrides)
    })
  })
})
