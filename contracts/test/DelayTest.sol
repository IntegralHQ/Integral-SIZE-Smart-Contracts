// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;
pragma abicoder v2;

import '../TwapDelay.sol';

contract DelayTest is TwapDelay {
    using Orders for Orders.Data;

    mapping(address => uint16) tolerance;

    constructor(address _factoryGovernor, address _bot) TwapDelay(_factoryGovernor, _bot) {}

    function setGasPrice(uint256 _gasPrice) public {
        orders.gasPrice = _gasPrice;
    }

    function testUpdateGasPrice(uint256 gasUsed) public {
        orders.updateGasPrice(gasUsed);
    }

    function testPerformRefund(Orders.Order calldata order, bool shouldRefundEth) public {
        performRefund(order, shouldRefundEth);
    }

    function getOrderHash(uint256 orderId) public view returns (bytes32) {
        return orders.orderQueue[orderId];
    }

    function setTolerance(address pair, uint16 _tolerance) public {
        tolerance[pair] = _tolerance;
    }

    // prettier-ignore
    function getTolerance(address pair) public view override returns (uint16) {
        uint16 _tolerance = tolerance[pair];
        if (_tolerance > 0) {
            return _tolerance;
        }

        // #if defined(TOLERANCE__PAIR_WETH_USDC) && (uint(TOLERANCE__PAIR_WETH_USDC) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_USDC_ADDRESS)  return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_USDC;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_USDC_E) && (uint(TOLERANCE__PAIR_WETH_USDC_E) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_USDC_E_ADDRESS)  return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_USDC_E;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_USDT) && (uint(TOLERANCE__PAIR_WETH_USDT) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_USDT_ADDRESS)  return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_USDT;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_WBTC) && (uint(TOLERANCE__PAIR_WETH_WBTC) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_WBTC_ADDRESS)  return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_WBTC;
        // #endif
        // #if defined(TOLERANCE__PAIR_USDC_USDT) && (uint(TOLERANCE__PAIR_USDC_USDT) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_USDC_USDT_ADDRESS)  return __MACRO__MAPPING.TOLERANCE__PAIR_USDC_USDT;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_CVX) && (uint(TOLERANCE__PAIR_WETH_CVX) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_CVX_ADDRESS)   return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_CVX;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_SUSHI) && (uint(TOLERANCE__PAIR_WETH_SUSHI) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_SUSHI_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_SUSHI;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_STETH) && (uint(TOLERANCE__PAIR_WETH_STETH) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_STETH_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_STETH;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_WSTETH) && (uint(TOLERANCE__PAIR_WETH_WSTETH) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_WSTETH_ADDRESS) return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_WSTETH;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_DAI) && (uint(TOLERANCE__PAIR_WETH_DAI) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_DAI_ADDRESS)   return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_DAI;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_RPL) && (uint(TOLERANCE__PAIR_WETH_RPL) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_RPL_ADDRESS)   return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_RPL;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_SWISE) && (uint(TOLERANCE__PAIR_WETH_SWISE) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_SWISE_ADDRESS)   return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_SWISE;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_LDO) && (uint(TOLERANCE__PAIR_WETH_LDO) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_LDO_ADDRESS)   return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_LDO;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_GMX) && (uint(TOLERANCE__PAIR_WETH_GMX) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_GMX_ADDRESS)   return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_GMX;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_ARB) && (uint(TOLERANCE__PAIR_WETH_ARB) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_ARB_ADDRESS)   return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_ARB;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_MKR) && (uint(TOLERANCE__PAIR_WETH_MKR) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_MKR_ADDRESS)   return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_MKR;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_UNI) && (uint(TOLERANCE__PAIR_WETH_UNI) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_UNI_ADDRESS)   return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_UNI;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_LINK) && (uint(TOLERANCE__PAIR_WETH_LINK) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_LINK_ADDRESS)   return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_LINK;
        // #endif
        // #if defined(TOLERANCE__PAIR_WETH_MNT) && (uint(TOLERANCE__PAIR_WETH_MNT) != uint(TOLERANCE__DEFAULT))
        if (pair == __MACRO__GLOBAL.PAIR_WETH_MNT_ADDRESS)   return __MACRO__MAPPING.TOLERANCE__PAIR_WETH_MNT;
        // #endif

        return 0;
    }

    function toUint16(bytes memory _bytes, uint256 _start) internal pure returns (uint16) {
        require(_bytes.length >= _start + 2, 'toUint16_outOfBounds');
        uint16 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x2), _start))
        }

        return tempUint;
    }
}
