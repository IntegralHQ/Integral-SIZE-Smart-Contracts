import { ContractReceipt, constants } from 'ethers'
import { Interface } from 'ethers/lib/utils'
import { Orders, Orders__factory } from '../../../build/types'
import { DepositEnqueuedEvent } from '../../../build/types/contracts/libraries/Orders'

const ordersEncoder = new Interface(Orders__factory.abi)

export function getBuyOrderData(receipt: ContractReceipt) {
  return getOrderData(receipt, buildBuyEventMeta())
}

export function getSellOrderData(receipt: ContractReceipt) {
  return getOrderData(receipt, buildSellEventMeta())
}

export function getDepositOrderData(receipt: ContractReceipt) {
  return getOrderData(receipt, buildDepositEventMeta())
}

export function getWithdrawOrderData(receipt: ContractReceipt) {
  return getOrderData(receipt, buildWithdrawEventMeta())
}

function getOrderData(receipt: ContractReceipt, eventTopic0s: string[]) {
  const orders: Orders.OrderStruct[] = []
  receipt.events?.forEach((event) => {
    if (eventTopic0s.includes(event.topics[0])) {
      const decodedData = ordersEncoder.parseLog({ topics: event.topics, data: event.data })
      const orderOutput = (decodedData as unknown as DepositEnqueuedEvent).args.order
      orders.push(buildOrderStructFromOutput(orderOutput))
    }
  })
  return orders
}

function buildEventTopic0s(events: string[]) {
  return events.map((eventName) => {
    const fragment = ordersEncoder.getEvent(eventName)
    return ordersEncoder.getEventTopic(fragment)
  })
}

function buildBuyEventMeta() {
  return buildEventTopic0s(['BuyEnqueued'])
}

function buildSellEventMeta() {
  return buildEventTopic0s(['SellEnqueued'])
}

function buildDepositEventMeta() {
  return buildEventTopic0s(['DepositEnqueued'])
}

function buildWithdrawEventMeta() {
  return buildEventTopic0s(['WithdrawEnqueued'])
}

function buildOrderStructFromOutput(output: Orders.OrderStructOutput): Orders.OrderStruct {
  return {
    orderId: output.orderId,
    orderType: output.orderType,
    validAfterTimestamp: output.validAfterTimestamp,
    unwrap: output.unwrap,
    timestamp: output.timestamp,
    gasLimit: output.gasLimit,
    gasPrice: output.gasPrice,
    liquidity: output.liquidity,
    value0: output.value0,
    value1: output.value1,
    token0: output.token0,
    token1: output.token1,
    to: output.to,
    minSwapPrice: output.minSwapPrice,
    maxSwapPrice: output.maxSwapPrice,
    swap: output.swap,
    priceAccumulator: output.priceAccumulator,
    amountLimit0: output.amountLimit0,
    amountLimit1: output.amountLimit1,
  }
}

export function buildEmptyOrder() {
  return {
    orderId: 0,
    orderType: 0,
    validAfterTimestamp: 0,
    unwrap: false,
    timestamp: 0,
    gasLimit: 0,
    gasPrice: 0,
    liquidity: 0,
    value0: 0,
    value1: 0,
    token0: constants.AddressZero,
    token1: constants.AddressZero,
    to: constants.AddressZero,
    minSwapPrice: 0,
    maxSwapPrice: 0,
    swap: false,
    priceAccumulator: 0,
    amountLimit0: 0,
    amountLimit1: 0,
  }
}
