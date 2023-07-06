import { utils } from 'ethers'
import { Interface } from 'ethers/lib/utils'
import { Orders, Orders__factory } from '../../../build/types'

const ordersEncoder = new Interface(Orders__factory.abi)

// Separating the struct is used to avoid the 'stack too deep' error in solidity.
const partialOrderDataParams0 = [
  'orderId',
  'orderType',
  'validAfterTimestamp',
  'unwrap',
  'timestamp',
  'gasLimit',
  'gasPrice',
  'liquidity',
  'value0',
  'value1',
  'token0',
  'token1',
  'to',
  'minSwapPrice',
]
const partialOrderDataParams1 = ['maxSwapPrice', 'swap', 'priceAccumulator', 'amountLimit0', 'amountLimit1']

export function getOrderDigest(order: Orders.OrderStruct) {
  const orderObject = order as { [key: string]: any }
  const fragment = ordersEncoder.getEvent('DepositEnqueued')

  const reduceCallback = (
    memo: {
      types: string[]
      values: any[]
    },
    partialOrderParam: string
  ) => {
    const i = fragment.inputs[1].components.findIndex((param) => param.name === partialOrderParam)
    if (i === -1) {
      throw new Error(`${partialOrderParam} parameter not found in Orders.${fragment.name} inputs[0]`)
    }
    const parameter = fragment.inputs[1].components[i]
    memo.types.push(parameter.type)
    memo.values.push(orderObject[parameter.name])
    return memo
  }

  const { types: typeList0, values: valueList0 } = partialOrderDataParams0.reduce(reduceCallback, {
    types: [],
    values: [],
  })
  const packedOrderDataParams0 = utils.solidityPack(typeList0, valueList0)

  const { types: typeList1, values: valueList1 } = partialOrderDataParams1.reduce(reduceCallback, {
    types: [],
    values: [],
  })
  const typeList = ['bytes'].concat(typeList1)
  const valueList = [packedOrderDataParams0].concat(valueList1)

  const packedOrderData = utils.solidityPack(typeList, valueList)
  const digest = utils.keccak256(packedOrderData)
  return digest
}
