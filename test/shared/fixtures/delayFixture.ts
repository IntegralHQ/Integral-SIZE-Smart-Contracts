import { Wallet } from 'ethers'
import { getDelayForPriceFixture, getDelayForPriceWithMaxTokenSupplyFixture } from './getDelayForPriceFixture'
import { getDelayForPriceOracleV3Fixture } from './getDelayForPriceOracleV3Fixture'

export async function delayFixture([wallet]: Wallet[]) {
  return await getDelayForPriceFixture(2)([wallet])
}

export async function delayWithMaxTokenSupplyFixture([wallet]: Wallet[]) {
  return await getDelayForPriceWithMaxTokenSupplyFixture(2)([wallet])
}

export async function delayOracleV3Fixture([wallet]: Wallet[]) {
  return await getDelayForPriceOracleV3Fixture(1, 2)([wallet])
}
