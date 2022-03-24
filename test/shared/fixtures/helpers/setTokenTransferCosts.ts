import { DelayTest, IERC20 } from '../../../../build/types'
import { overrides } from '../../utilities'

export async function setTokenTransferCosts(delay: DelayTest, tokens: IERC20[]) {
  for (const token of tokens) {
    await delay.setTransferGasCost(token.address, 60_000, overrides)
  }
}
