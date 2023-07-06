import { BigNumber, BigNumberish } from 'ethers'

export enum OrderType {
  Empty,
  Deposit,
  Withdraw,
  Sell,
  Buy,
}

export enum OrderInternalType {
  DEPOSIT_TYPE = 1,
  WITHDRAW_TYPE = 2,
  BUY_TYPE = 3,
  BUY_INVERTED_TYPE = 4,
  SELL_TYPE = 5,
  SELL_INVERTED_TYPE = 6,
}

export function decodeOrderType(_internalType: BigNumberish) {
  const internalType = BigNumber.from(_internalType).toNumber()
  switch (internalType) {
    case OrderInternalType.DEPOSIT_TYPE:
      return OrderType.Deposit
    case OrderInternalType.WITHDRAW_TYPE:
      return OrderType.Withdraw
    case OrderInternalType.BUY_TYPE:
    case OrderInternalType.BUY_INVERTED_TYPE:
      return OrderType.Buy
    case OrderInternalType.SELL_TYPE:
    case OrderInternalType.SELL_INVERTED_TYPE:
      return OrderType.Sell
    default:
      return OrderType.Empty
  }
}
