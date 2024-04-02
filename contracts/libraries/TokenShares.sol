// SPDX-License-Identifier: GPL-3.0-or-later
// Deployed with donations via Gitcoin GR9

pragma solidity 0.7.6;

import '../interfaces/IERC20.sol';
import '../interfaces/IWETH.sol';
import './SafeMath.sol';
import './TransferHelper.sol';
import './Macros.sol';

library TokenShares {
    using SafeMath for uint256;
    using TransferHelper for address;

    uint256 private constant PRECISION = 10 ** 18;
    uint256 private constant TOLERANCE = 10 ** 18 + 10 ** 16;
    uint256 private constant TOTAL_SHARES_PRECISION = 10 ** 18;

    event UnwrapFailed(address to, uint256 amount);

    // represents wrapped native currency (WETH or WMATIC)
    address public constant WETH_ADDRESS = 0x0f0f0F0f0f0F0F0f0F0F0F0F0F0F0f0f0F0F0F0F   /*__MACRO__GLOBAL.TOKEN_WETH_ADDRESS*/; //prettier-ignore

    struct Data {
        mapping(address => uint256) totalShares;
    }

    function sharesToAmount(
        Data storage data,
        address token,
        uint256 share,
        uint256 amountLimit,
        address refundTo
    ) external returns (uint256) {
        if (share == 0) {
            return 0;
        }
        if (token == WETH_ADDRESS || isNonRebasing(token)) {
            return share;
        }

        uint256 totalTokenShares = data.totalShares[token];
        require(totalTokenShares >= share, 'TS3A');
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 value = balance.mul(share).div(totalTokenShares);
        data.totalShares[token] = totalTokenShares.sub(share);

        if (amountLimit > 0) {
            uint256 amountLimitWithTolerance = amountLimit.mul(TOLERANCE).div(PRECISION);
            if (value > amountLimitWithTolerance) {
                TransferHelper.safeTransfer(token, refundTo, value.sub(amountLimitWithTolerance));
                return amountLimitWithTolerance;
            }
        }

        return value;
    }

    function amountToShares(Data storage data, address token, uint256 amount, bool wrap) external returns (uint256) {
        if (amount == 0) {
            return 0;
        }
        if (token == WETH_ADDRESS) {
            if (wrap) {
                require(msg.value >= amount, 'TS03');
                IWETH(token).deposit{ value: amount }();
            } else {
                token.safeTransferFrom(msg.sender, address(this), amount);
            }
            return amount;
        } else if (isNonRebasing(token)) {
            token.safeTransferFrom(msg.sender, address(this), amount);
            return amount;
        } else {
            uint256 balanceBefore = IERC20(token).balanceOf(address(this));
            token.safeTransferFrom(msg.sender, address(this), amount);
            uint256 balanceAfter = IERC20(token).balanceOf(address(this));

            return amountToSharesHelper(data, token, balanceBefore, balanceAfter);
        }
    }

    function amountToSharesWithoutTransfer(
        Data storage data,
        address token,
        uint256 amount,
        bool wrap
    ) external returns (uint256) {
        if (token == WETH_ADDRESS) {
            if (wrap) {
                // require(msg.value >= amount, 'TS03'); // Duplicate check in TwapRelayer.sell
                IWETH(token).deposit{ value: amount }();
            }
            return amount;
        } else if (isNonRebasing(token)) {
            return amount;
        } else {
            uint256 balanceAfter = IERC20(token).balanceOf(address(this));
            uint256 balanceBefore = balanceAfter.sub(amount);
            return amountToSharesHelper(data, token, balanceBefore, balanceAfter);
        }
    }

    function amountToSharesHelper(
        Data storage data,
        address token,
        uint256 balanceBefore,
        uint256 balanceAfter
    ) internal returns (uint256) {
        uint256 totalTokenShares = data.totalShares[token];
        require(balanceBefore > 0 || totalTokenShares == 0, 'TS30');
        require(balanceAfter > balanceBefore, 'TS2C');

        if (balanceBefore > 0) {
            if (totalTokenShares == 0) {
                totalTokenShares = balanceBefore.mul(TOTAL_SHARES_PRECISION);
            }
            uint256 newShares = totalTokenShares.mul(balanceAfter).div(balanceBefore);
            require(balanceAfter < type(uint256).max.div(newShares), 'TS73'); // to prevent overflow at execution
            data.totalShares[token] = newShares;
            return newShares - totalTokenShares;
        } else {
            totalTokenShares = balanceAfter.mul(TOTAL_SHARES_PRECISION);
            require(totalTokenShares < type(uint256).max.div(totalTokenShares), 'TS73'); // to prevent overflow at execution
            data.totalShares[token] = totalTokenShares;
            return totalTokenShares;
        }
    }

    function onUnwrapFailed(address to, uint256 amount) external {
        emit UnwrapFailed(to, amount);
        IWETH(WETH_ADDRESS).deposit{ value: amount }();
        TransferHelper.safeTransfer(WETH_ADDRESS, to, amount);
    }

    // prettier-ignore
    // constant mapping for nonRebasingToken
    function isNonRebasing(address/* #if !bool(IS_NON_REBASING) */ token/* #endif */) internal pure returns (bool) {
        // #if defined(IS_NON_REBASING__TOKEN_WETH) && (uint(IS_NON_REBASING__TOKEN_WETH) != uint(IS_NON_REBASING__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_WETH_ADDRESS) return __MACRO__MAPPING.IS_NON_REBASING__TOKEN_WETH;
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_USDC) && (uint(IS_NON_REBASING__TOKEN_USDC) != uint(IS_NON_REBASING__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_USDC_ADDRESS) return __MACRO__MAPPING.IS_NON_REBASING__TOKEN_USDC;
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_USDC_E) && (uint(IS_NON_REBASING__TOKEN_USDC_E) != uint(IS_NON_REBASING__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_USDC_E_ADDRESS) return __MACRO__MAPPING.IS_NON_REBASING__TOKEN_USDC_E;
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_USDT) && (uint(IS_NON_REBASING__TOKEN_USDT) != uint(IS_NON_REBASING__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_USDT_ADDRESS) return __MACRO__MAPPING.IS_NON_REBASING__TOKEN_USDT;
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_WBTC) && (uint(IS_NON_REBASING__TOKEN_WBTC) != uint(IS_NON_REBASING__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_WBTC_ADDRESS) return __MACRO__MAPPING.IS_NON_REBASING__TOKEN_WBTC;
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_CVX) && (uint(IS_NON_REBASING__TOKEN_CVX) != uint(IS_NON_REBASING__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_CVX_ADDRESS) return __MACRO__MAPPING.IS_NON_REBASING__TOKEN_CVX;
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_SUSHI) && (uint(IS_NON_REBASING__TOKEN_SUSHI) != uint(IS_NON_REBASING__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_SUSHI_ADDRESS) return __MACRO__MAPPING.IS_NON_REBASING__TOKEN_SUSHI;
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_STETH) && (uint(IS_NON_REBASING__TOKEN_STETH) != uint(IS_NON_REBASING__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_STETH_ADDRESS) return __MACRO__MAPPING.IS_NON_REBASING__TOKEN_STETH;
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_WSTETH) && (uint(IS_NON_REBASING__TOKEN_WSTETH) != uint(IS_NON_REBASING__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_WSTETH_ADDRESS) return __MACRO__MAPPING.IS_NON_REBASING__TOKEN_WSTETH;
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_DAI) && (uint(IS_NON_REBASING__TOKEN_DAI) != uint(IS_NON_REBASING__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_DAI_ADDRESS) return __MACRO__MAPPING.IS_NON_REBASING__TOKEN_DAI;
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_RPL) && (uint(IS_NON_REBASING__TOKEN_RPL) != uint(IS_NON_REBASING__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_RPL_ADDRESS) return __MACRO__MAPPING.IS_NON_REBASING__TOKEN_RPL;
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_SWISE) && (uint(IS_NON_REBASING__TOKEN_SWISE) != uint(IS_NON_REBASING__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_SWISE_ADDRESS) return __MACRO__MAPPING.IS_NON_REBASING__TOKEN_SWISE;
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_LDO) && (uint(IS_NON_REBASING__TOKEN_LDO) != uint(IS_NON_REBASING__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_LDO_ADDRESS) return __MACRO__MAPPING.IS_NON_REBASING__TOKEN_LDO;
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_GMX) && (uint(IS_NON_REBASING__TOKEN_GMX) != uint(IS_NON_REBASING__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_GMX_ADDRESS) return __MACRO__MAPPING.IS_NON_REBASING__TOKEN_GMX;
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_ARB) && (uint(IS_NON_REBASING__TOKEN_ARB) != uint(IS_NON_REBASING__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_ARB_ADDRESS) return __MACRO__MAPPING.IS_NON_REBASING__TOKEN_ARB;
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_MKR) && (uint(IS_NON_REBASING__TOKEN_MKR) != uint(IS_NON_REBASING__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_MKR_ADDRESS) return __MACRO__MAPPING.IS_NON_REBASING__TOKEN_MKR;
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_UNI) && (uint(IS_NON_REBASING__TOKEN_UNI) != uint(IS_NON_REBASING__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_UNI_ADDRESS) return __MACRO__MAPPING.IS_NON_REBASING__TOKEN_UNI;
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_LINK) && (uint(IS_NON_REBASING__TOKEN_LINK) != uint(IS_NON_REBASING__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_LINK_ADDRESS) return __MACRO__MAPPING.IS_NON_REBASING__TOKEN_LINK;
        // #endif
        // #if defined(IS_NON_REBASING__TOKEN_MNT) && (uint(IS_NON_REBASING__TOKEN_MNT) != uint(IS_NON_REBASING__DEFAULT))
        if (token == __MACRO__GLOBAL.TOKEN_MNT_ADDRESS) return __MACRO__MAPPING.IS_NON_REBASING__TOKEN_MNT;
        // #endif
        return __MACRO__MAPPING.IS_NON_REBASING__DEFAULT;
    }
}
