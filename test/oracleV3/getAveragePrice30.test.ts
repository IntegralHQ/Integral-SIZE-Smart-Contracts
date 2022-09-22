import { expect } from 'chai'
import { MockProvider } from 'ethereum-waffle'
import { getOracleV3WithUniswapFixtureFor } from '../shared/fixtures/getOracleV3WithUniswapFixtureFor'
import { setupFixtureLoader } from '../shared/setup'
import { expandToDecimals, expandTo18Decimals, increaseTime, overrides } from '../shared/utilities'
import { FeeAmount, getPricefromSqrtRatioX96, getSqrtRatioAtTick } from '../shared/uniswapV3Utilities'
import { BigNumber } from 'ethers'

const REQUIRED_CARDINALITY = 5
const HALF_HOUR = 60 * 30
const ONE_HOUR = 60 * 60
const ONE = BigNumber.from(10).pow(18)

const CONFIGURATIONS = [
  [100_000, 20_000, 10, 10],
  [1000, 180_000, 18, 18],
  [100_000, 20_000, 18, 10],
  [100_000, 20_000, 10, 18],
  [100_000, 6_135_635, 18, 6],
  [6_127_919, 100_000, 6, 18],
]
const SWAP_AMOUNT = [1_000, 20_000, 10_000]

type Observation = { timestamp: BigNumber; tickCumulative: BigNumber; tick: BigNumber }

describe('TwapOracleV3.getAveragePrice30', () => {
  const loadFixture = setupFixtureLoader()

  for (const [xSupply, ySupply, xDecimals, yDecimals] of CONFIGURATIONS) {
    for (const swapAmount of SWAP_AMOUNT) {
      it(`trades with expected twap decimals=${xDecimals}/${yDecimals}, reserves=${xSupply}/${ySupply}, amount=${swapAmount}`, async () => {
        const timePoints: { [points: string]: BigNumber } = {}
        const { provider, pool, setUniswapPrice, addLiquidity, oracle, wallet, token0, token1, router } =
          await loadFixture(getOracleV3WithUniswapFixtureFor(xDecimals, yDecimals))
        await setUniswapPrice(expandToDecimals(xSupply, xDecimals), expandToDecimals(ySupply, yDecimals))
        timePoints.initialized = await getCurrentBlockTimestamp(provider)
        await pool.increaseObservationCardinalityNext(REQUIRED_CARDINALITY, overrides)
        await addLiquidity(expandToDecimals(xSupply, xDecimals), expandToDecimals(ySupply, yDecimals))
        timePoints.addedLiquidity = await getCurrentBlockTimestamp(provider)
        await oracle.setUniswapPair(pool.address, overrides)
        await increaseTime(wallet, ONE_HOUR)

        await router.swapOnUniswap({
          recipient: wallet.address,
          amountIn: expandToDecimals(swapAmount, yDecimals),
          amountOutMinimum: 0,
          fee: FeeAmount.LOW,
          tokenIn: token1,
          tokenOut: token0,
        })
        timePoints.swapped = await getCurrentBlockTimestamp(provider)

        await increaseTime(wallet, HALF_HOUR)
        timePoints.final = await getCurrentBlockTimestamp(provider)
        // timeElapsed is 30 min plus 10 seconds to cover sync operations
        const timeElapsed = timePoints.final.sub(timePoints.swapped).add(10)
        await oracle.setTwapInterval(timeElapsed)
        const oracleAveragePrice30 = await oracle.getAveragePrice(0, 0, overrides)

        const expectedAveragePrice30 = calculateAveragePriceOneSwap(
          [xSupply, ySupply],
          swapAmount,
          timePoints,
          timeElapsed
        )

        expect(oracleAveragePrice30).to.be.gte(expectedAveragePrice30.mul(995).div(1000))
        expect(oracleAveragePrice30).to.be.lte(expectedAveragePrice30)
      })
    }

    it(`verify twap calculation results`, async () => {
      const localObservations: Observation[] = []
      let observationIndex = 0
      const { pool, setUniswapPrice, addLiquidity, oracle, wallet, token0, token1, router, other, another, provider } =
        await loadFixture(getOracleV3WithUniswapFixtureFor(xDecimals, yDecimals))
      await setUniswapPrice(expandToDecimals(xSupply, xDecimals), expandToDecimals(ySupply, yDecimals))
      localObservations.push({
        timestamp: BigNumber.from((await pool.observations(observationIndex++)).blockTimestamp),
        tickCumulative: BigNumber.from(0),
        tick: BigNumber.from((await pool.slot0()).tick),
      })

      await pool.increaseObservationCardinalityNext(REQUIRED_CARDINALITY, overrides)
      await addLiquidity(expandToDecimals(xSupply, xDecimals), expandToDecimals(ySupply, yDecimals))
      await oracle.setUniswapPair(pool.address, overrides)
      writeObservation(
        localObservations,
        await pool.slot0(),
        BigNumber.from((await pool.observations(observationIndex++)).blockTimestamp)
      )

      const swapTimestamps: BigNumber[] = []
      const recipients = [wallet, other, another]
      for (const [i, yAmountSwap] of SWAP_AMOUNT.entries()) {
        await router.swapOnUniswap({
          recipient: recipients[i].address,
          amountIn: expandToDecimals(yAmountSwap, yDecimals),
          amountOutMinimum: 0,
          fee: FeeAmount.LOW,
          tokenIn: token1,
          tokenOut: token0,
        })
        const timestamp = BigNumber.from((await pool.observations(observationIndex++)).blockTimestamp)
        writeObservation(localObservations, await pool.slot0(), timestamp)
        swapTimestamps.push(timestamp)
        await increaseTime(wallet, HALF_HOUR)
      }

      const finalTimestamp = await getCurrentBlockTimestamp(provider)
      const timeElapsed = finalTimestamp.sub(swapTimestamps[2])
      await oracle.setTwapInterval(timeElapsed)
      const oracleAveragePrice = await oracle.getAveragePrice(0, 0, overrides)

      const arithmeticMeanTickLocalObservation = getArithmeticMeanTickLocalObservation(
        localObservations,
        finalTimestamp,
        BigNumber.from((await pool.slot0()).tick),
        BigNumber.from(timeElapsed)
      )
      const priceX96LocalObservation = getSqrtRatioAtTick(arithmeticMeanTickLocalObservation.toNumber())
      const expectedPriceLocalObservation = getPricefromSqrtRatioX96(xDecimals, yDecimals, priceX96LocalObservation)

      expect(expectedPriceLocalObservation).to.be.eq(oracleAveragePrice)
    })
  }
})

function writeObservation(
  localObservations: Observation[],
  slot0: { sqrtPriceX96: BigNumber; tick: number },
  timestamp: BigNumber = BigNumber.from(0)
) {
  const lastObservation = localObservations[localObservations.length - 1]
  localObservations.push({
    ...transform(lastObservation, timestamp, lastObservation.tick),
    tick: BigNumber.from(slot0.tick),
  })
}

function transform(lastObservation: Observation, timestamp: BigNumber, tick: BigNumber) {
  const timestampDelta = timestamp.sub(lastObservation.timestamp)
  const tickCumulative = lastObservation.tickCumulative.add(tick.mul(timestampDelta))
  return { timestamp, tickCumulative }
}

function getArithmeticMeanTickLocalObservation(
  localObservations: Observation[],
  timestamp: BigNumber,
  tick: BigNumber,
  secondsAgo: BigNumber
) {
  const tickCumulatives = observe(localObservations, timestamp, tick, [secondsAgo, BigNumber.from(0)])
  const tickCumulativesDelta = tickCumulatives[1].sub(tickCumulatives[0])
  let arithmeticMeanTick = tickCumulativesDelta.div(secondsAgo)
  if (tickCumulativesDelta.lt(0) && !tickCumulativesDelta.mod(secondsAgo).isZero()) {
    arithmeticMeanTick = arithmeticMeanTick.sub(1)
  }
  return arithmeticMeanTick
}

function observe(localObservations: Observation[], timestamp: BigNumber, tick: BigNumber, secondsAgos: BigNumber[]) {
  const tickCumulatives = []
  for (let i = 0; i < secondsAgos.length; i++) {
    tickCumulatives.push(observeSingle(localObservations, timestamp, tick, secondsAgos[i]))
  }
  return tickCumulatives
}

function observeSingle(
  localObservations: Observation[],
  timestamp: BigNumber,
  tick: BigNumber,
  secondsAgo: BigNumber
): BigNumber {
  if (secondsAgo.isZero()) {
    const lastObservation = localObservations[localObservations.length - 1]
    if (!lastObservation.timestamp.eq(timestamp)) {
      lastObservation.tickCumulative = transform(lastObservation, timestamp, tick).tickCumulative
    }
    return lastObservation.tickCumulative
  }
  const target = timestamp.sub(secondsAgo)
  for (let i = localObservations.length - 1; i > 0; i--) {
    const observationLow = localObservations[i - 1]
    const observationHigh = localObservations[i]
    if (target.eq(observationLow.timestamp)) {
      return observationLow.tickCumulative
    } else if (target.eq(observationHigh.timestamp)) {
      return observationHigh.tickCumulative
    } else if (target.gt(observationLow.timestamp) && target.lt(observationHigh.timestamp)) {
      const observationTimeDelta = observationHigh.timestamp.sub(observationLow.timestamp)
      const targetDelta = target.sub(observationLow.timestamp)
      return observationLow.tickCumulative.add(
        observationHigh.tickCumulative.sub(observationLow.tickCumulative).div(observationTimeDelta).mul(targetDelta)
      )
    }
  }
  throw new Error('NO OBSERVATION FOUND')
}

async function getCurrentBlockTimestamp(provider: MockProvider) {
  const block = await provider.getBlock('latest')
  return BigNumber.from(block.timestamp)
}

// Manuallly calculate average price using observation logic but based on spot price
function calculateAveragePriceOneSwap(
  supplies: number[],
  swapAmount: number,
  tags: { [tagName: string]: BigNumber },
  secondsAgo: BigNumber
): BigNumber {
  const [xSupply, ySupply] = supplies
  const amountIn = expandTo18Decimals(swapAmount)
  const ySupplyAfterSwap = expandTo18Decimals(ySupply).add(amountIn)
  const k = expandTo18Decimals(ySupply).mul(expandTo18Decimals(xSupply))
  const amountOut = expandTo18Decimals(xSupply).sub(k.div(ySupplyAfterSwap))
  const spotPriceAfterSwap = ySupplyAfterSwap.mul(ONE).div(expandTo18Decimals(xSupply).sub(amountOut))
  const spotPriceInitial = expandTo18Decimals(ySupply).mul(ONE).div(expandTo18Decimals(xSupply))

  const targetTimestamp = tags.final.sub(secondsAgo)
  const targetDelta = targetTimestamp.sub(tags.addedLiquidity)
  const averageLow = spotPriceInitial.mul(tags.addedLiquidity.sub(tags.initialized))
  const averageHigh = averageLow.add(spotPriceInitial.mul(tags.swapped.sub(tags.addedLiquidity)))
  const averageResultHigh = averageHigh.add(spotPriceAfterSwap.mul(tags.final.sub(tags.swapped)))
  const averageResultLow = averageHigh.sub(averageLow).div(tags.swapped.sub(tags.addedLiquidity)).mul(targetDelta)
  return averageResultHigh.sub(averageResultLow).div(secondsAgo)
}
