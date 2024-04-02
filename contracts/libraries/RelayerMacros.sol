// SPDX-License-Identifier: GPL-3.0-or-later
// Deployed with donations via Gitcoin GR9

pragma solidity 0.7.6;
pragma abicoder v2;

import './Orders.sol';
import './Macros.sol';

library RelayerMacros {
    struct Node {
        address pair;
        address token0;
        address token1;
    }

    event EthTransferGasCostSet(uint256 gasCost);
    event ToleranceSet(address pair, uint16 tolerance);
    event TokenLimitsSet(address token, uint256 min, uint256 max);
    event TwapIntervalSet(address pair, uint32 interval);

    // prettier-ignore
    function getPath(address tokenIn, address tokenOut) external pure returns (Node[] memory) {
        // #if defined(PAIR_WETH_USDC_ADDRESS) && defined(PAIR_WETH_WBTC_ADDRESS)
        if (tokenIn == __MACRO__GLOBAL.TOKEN_USDC_ADDRESS && tokenOut == __MACRO__GLOBAL.TOKEN_WBTC_ADDRESS) {
            Node[] memory path = new Node[](2);
            path[0] = Node(
                __MACRO__GLOBAL.PAIR_WETH_USDC_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_USDC_TOKEN0_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_USDC_TOKEN1_ADDRESS
            );
            path[1] = Node(
                __MACRO__GLOBAL.PAIR_WETH_WBTC_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_WBTC_TOKEN0_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_WBTC_TOKEN1_ADDRESS
            );
            return path;
        }
        // #endif
        // #if defined(PAIR_WETH_USDC_ADDRESS) && defined(PAIR_WETH_WBTC_ADDRESS)
        if (tokenIn == __MACRO__GLOBAL.TOKEN_WBTC_ADDRESS && tokenOut == __MACRO__GLOBAL.TOKEN_USDC_ADDRESS) {
            Node[] memory path = new Node[](2);
            path[0] = Node(
                __MACRO__GLOBAL.PAIR_WETH_WBTC_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_WBTC_TOKEN0_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_WBTC_TOKEN1_ADDRESS
            );
            path[1] = Node(
                __MACRO__GLOBAL.PAIR_WETH_USDC_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_USDC_TOKEN0_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_USDC_TOKEN1_ADDRESS
            );
            return path;
        }
        // #endif
        // #if defined(PAIR_WETH_USDC_ADDRESS) && defined(PAIR_WETH_USDC_E_ADDRESS)
        if (tokenIn == __MACRO__GLOBAL.TOKEN_USDC_ADDRESS && tokenOut == __MACRO__GLOBAL.TOKEN_USDC_E_ADDRESS) {
            Node[] memory path = new Node[](2);
            path[0] = Node(
                __MACRO__GLOBAL.PAIR_WETH_USDC_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_USDC_TOKEN0_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_USDC_TOKEN1_ADDRESS
            );
            path[1] = Node(
                __MACRO__GLOBAL.PAIR_WETH_USDC_E_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_USDC_E_TOKEN0_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_USDC_E_TOKEN1_ADDRESS
            );
            return path;
        }
        // #endif
        // #if defined(PAIR_WETH_USDC_ADDRESS) && defined(PAIR_WETH_USDC_E_ADDRESS)
        if (tokenIn == __MACRO__GLOBAL.TOKEN_USDC_E_ADDRESS && tokenOut == __MACRO__GLOBAL.TOKEN_USDC_ADDRESS) {
            Node[] memory path = new Node[](2);
            path[0] = Node(
                __MACRO__GLOBAL.PAIR_WETH_USDC_E_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_USDC_E_TOKEN0_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_USDC_E_TOKEN1_ADDRESS
            );
            path[1] = Node(
                __MACRO__GLOBAL.PAIR_WETH_USDC_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_USDC_TOKEN0_ADDRESS,
                __MACRO__GLOBAL.PAIR_WETH_USDC_TOKEN1_ADDRESS
            );
            return path;
        }
        // #endif

        revert('TR17');
    }

    // prettier-ignore
    function _emitEventWithDefaults() external {
        emit EthTransferGasCostSet(Orders.ETHER_TRANSFER_COST);

        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_USDC)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_USDC_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_USDC);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_USDC_E)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_USDC_E_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_USDC_E);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_USDT)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_USDT_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_USDT);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_WBTC)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_WBTC_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_WBTC);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_USDC_USDT)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_USDC_USDT_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_USDC_USDT);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_CVX)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_CVX_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_CVX);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_SUSHI)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_SUSHI_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_SUSHI);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_STETH)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_STETH_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_STETH);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_WSTETH)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_WSTETH_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_WSTETH);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_DAI)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_DAI_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_DAI);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_RPL)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_RPL_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_RPL);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_SWISE)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_SWISE_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_SWISE);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_LDO)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_LDO_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_LDO);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_GMX)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_GMX_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_GMX);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_ARB)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_ARB_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_ARB);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_MKR)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_MKR_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_MKR);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_UNI)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_UNI_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_UNI);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_LINK)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_LINK_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_LINK);
        // #endif
        // #if defined(RELAYER_TOLERANCE__PAIR_WETH_MNT)
        emit ToleranceSet(__MACRO__GLOBAL.PAIR_WETH_MNT_ADDRESS, __MACRO__MAPPING.RELAYER_TOLERANCE__PAIR_WETH_MNT);
        // #endif

        // #if defined(TOKEN_LIMIT_MIN__TOKEN_WETH) && defined(TOKEN_LIMIT_MAX__TOKEN_WETH)
        emit TokenLimitsSet(__MACRO__GLOBAL.TOKEN_WETH_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_WETH, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_WETH);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_USDC) && defined(TOKEN_LIMIT_MAX__TOKEN_USDC)
        emit TokenLimitsSet(__MACRO__GLOBAL.TOKEN_USDC_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_USDC, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_USDC);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_USDC_E) && defined(TOKEN_LIMIT_MAX__TOKEN_USDC_E)
        emit TokenLimitsSet(__MACRO__GLOBAL.TOKEN_USDC_E_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_USDC_E, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_USDC_E);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_USDT) && defined(TOKEN_LIMIT_MAX__TOKEN_USDT)
        emit TokenLimitsSet(__MACRO__GLOBAL.TOKEN_USDT_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_USDT, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_USDT);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_WBTC) && defined(TOKEN_LIMIT_MAX__TOKEN_WBTC)
        emit TokenLimitsSet(__MACRO__GLOBAL.TOKEN_WBTC_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_WBTC, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_WBTC);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_CVX) && defined(TOKEN_LIMIT_MAX__TOKEN_CVX)
        emit TokenLimitsSet(__MACRO__GLOBAL.TOKEN_CVX_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_CVX, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_CVX);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_SUSHI) && defined(TOKEN_LIMIT_MAX__TOKEN_SUSHI)
        emit TokenLimitsSet(__MACRO__GLOBAL.TOKEN_SUSHI_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_SUSHI, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_SUSHI);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_STETH) && defined(TOKEN_LIMIT_MAX__TOKEN_STETH)
        emit TokenLimitsSet(__MACRO__GLOBAL.TOKEN_STETH_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_STETH, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_STETH);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_WSTETH) && defined(TOKEN_LIMIT_MAX__TOKEN_WSTETH)
        emit TokenLimitsSet(__MACRO__GLOBAL.TOKEN_WSTETH_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_WSTETH, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_WSTETH);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_DAI) && defined(TOKEN_LIMIT_MAX__TOKEN_DAI)
        emit TokenLimitsSet(__MACRO__GLOBAL.TOKEN_DAI_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_DAI, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_DAI);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_RPL) && defined(TOKEN_LIMIT_MAX__TOKEN_RPL)
        emit TokenLimitsSet(__MACRO__GLOBAL.TOKEN_RPL_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_RPL, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_RPL);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_SWISE) && defined(TOKEN_LIMIT_MAX__TOKEN_SWISE)
        emit TokenLimitsSet(__MACRO__GLOBAL.TOKEN_SWISE_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_SWISE, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_SWISE);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_LDO) && defined(TOKEN_LIMIT_MAX__TOKEN_LDO)
        emit TokenLimitsSet(__MACRO__GLOBAL.TOKEN_LDO_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_LDO, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_LDO);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_GMX) && defined(TOKEN_LIMIT_MAX__TOKEN_GMX)
        emit TokenLimitsSet(__MACRO__GLOBAL.TOKEN_GMX_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_GMX, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_GMX);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_ARB) && defined(TOKEN_LIMIT_MAX__TOKEN_ARB)
        emit TokenLimitsSet(__MACRO__GLOBAL.TOKEN_ARB_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_ARB, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_ARB);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_MKR) && defined(TOKEN_LIMIT_MAX__TOKEN_MKR)
        emit TokenLimitsSet(__MACRO__GLOBAL.TOKEN_MKR_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_MKR, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_MKR);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_UNI) && defined(TOKEN_LIMIT_MAX__TOKEN_UNI)
        emit TokenLimitsSet(__MACRO__GLOBAL.TOKEN_UNI_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_UNI, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_UNI);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_LINK) && defined(TOKEN_LIMIT_MAX__TOKEN_LINK)
        emit TokenLimitsSet(__MACRO__GLOBAL.TOKEN_LINK_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_LINK, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_LINK);
        // #endif
        // #if defined(TOKEN_LIMIT_MIN__TOKEN_MNT) && defined(TOKEN_LIMIT_MAX__TOKEN_MNT)
        emit TokenLimitsSet(__MACRO__GLOBAL.TOKEN_MNT_ADDRESS, __MACRO__MAPPING.TOKEN_LIMIT_MIN__TOKEN_MNT, __MACRO__MAPPING.TOKEN_LIMIT_MAX__TOKEN_MNT);
        // #endif

        // #if defined(TWAP_INTERVAL__PAIR_WETH_USDC)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_USDC_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_USDC);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_USDC_E)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_USDC_E_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_USDC_E);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_USDT)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_USDT_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_USDT);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_WBTC)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_WBTC_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_WBTC);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_USDC_USDT)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_USDC_USDT_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_USDC_USDT);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_CVX)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_CVX_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_CVX);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_SUSHI)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_SUSHI_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_SUSHI);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_STETH)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_STETH_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_STETH);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_WSTETH)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_WSTETH_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_WSTETH);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_DAI)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_DAI_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_DAI);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_RPL)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_RPL_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_RPL);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_SWISE)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_SWISE_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_SWISE);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_LDO)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_LDO_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_LDO);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_GMX)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_GMX_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_GMX);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_ARB)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_ARB_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_ARB);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_MKR)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_MKR_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_MKR);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_UNI)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_UNI_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_UNI);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_LINK)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_LINK_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_LINK);
        // #endif
        // #if defined(TWAP_INTERVAL__PAIR_WETH_MNT)
        emit TwapIntervalSet(__MACRO__GLOBAL.PAIR_WETH_MNT_ADDRESS, __MACRO__MAPPING.TWAP_INTERVAL__PAIR_WETH_MNT);
        // #endif
    }
}
