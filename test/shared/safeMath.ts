import { BigNumber, BigNumberish } from 'ethers'

// https://github.com/EmergentHQ/integral/blob/master-twap/packages/contracts/contracts/libraries/SafeMath.sol#L36
export function ceil_div(self: BigNumberish, other: BigNumberish): BigNumber {
  const a = BigNumber.from(self)
  const b = BigNumber.from(other)
  const c = a.div(b)

  if (a != b.mul(c)) {
    return c.add(1)
  } else {
    return c
  }
}
