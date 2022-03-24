// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;

import '../libraries/Reserves.sol';

contract ReservesTest is Reserves {
    address token0;
    address token1;

    constructor(address _token0, address _token1) {
        token0 = _token0;
        token1 = _token1;
    }

    function testAddFees(uint256 fee0, uint256 fee1) public {
        addFees(fee0, fee1);
    }

    function testSetReserves() public {
        (uint256 balance0, uint256 balance1) = getBalances(token0, token1);
        setReserves(balance0, balance1);
    }

    function testSyncReserves() public {
        syncReserves(token0, token1);
    }
}
