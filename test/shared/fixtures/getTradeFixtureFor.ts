import { BigNumberish, Wallet } from 'ethers'
import { expandTo18Decimals, expandToDecimals, overrides } from '../utilities'
import { getOracleFixtureFor } from './getOracleFixtureFor'

export function getTradeFixtureFor(xDecimals: number, yDecimals: number, price: string) {
  return async function ([wallet]: Wallet[]) {
    const { oracle } = await getOracleFixtureFor(xDecimals, yDecimals)([wallet])
    const priceInfo = await oracle.testEncodeGivenPrice(expandTo18Decimals(price), overrides)

    function toDecimals(number: string, decimals: number) {
      const [integer, fractions] = number.split('.')
      const value = [integer, fractions && fractions.slice(0, decimals)].join('.')
      return expandToDecimals(value, decimals)
    }

    function tradeX(xAfter: BigNumberish, xBefore: BigNumberish, yBefore: BigNumberish) {
      return oracle.tradeX(
        toDecimals(xAfter.toString(), xDecimals),
        toDecimals(xBefore.toString(), xDecimals),
        toDecimals(yBefore.toString(), yDecimals),
        priceInfo,
        overrides
      )
    }

    function tradeY(yAfter: BigNumberish, xBefore: BigNumberish, yBefore: BigNumberish) {
      return oracle.tradeY(
        toDecimals(yAfter.toString(), yDecimals),
        toDecimals(xBefore.toString(), xDecimals),
        toDecimals(yBefore.toString(), yDecimals),
        priceInfo,
        overrides
      )
    }

    return { tradeX, tradeY, toDecimals }
  }
}
