import { setupFixtureLoader } from '../shared/setup'
import { delayOracleV3Fixture } from '../shared/fixtures'
import { expect } from 'chai'
import { LimitOrderStatus } from '../shared/LimitOrderStatus'

describe('test access non existed order', () => {
  const loadFixture = setupFixtureLoader()

  it('access non existed order should be reverted', async () => {
    const { limitOrder } = await loadFixture(delayOracleV3Fixture)
    await expect(limitOrder.getOrder(0)).to.revertedWith('TL62')
    const orderStatus = await limitOrder.getOrderStatus(0)
    expect(orderStatus).to.eq(LimitOrderStatus.NonExistent)
    await expect(limitOrder.getDelayOrderId(0)).to.revertedWith('TL62')
  })
})
