// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;

import '../interfaces/IERC20.sol';
import '../libraries/TransferHelper.sol';

contract TokenGasTest {
    using TransferHelper for address;
    event GasUsed(uint256 value);

    uint256 public x;

    function bstx() public {}

    function set(uint256 value) public {
        x = value;
    }

    function setNonZero() public {
        uint256 start = gasleft();
        set(1337);
        uint256 used = start - gasleft();
        emit GasUsed(used);
    }

    function setZero() public {
        uint256 start = gasleft();
        set(0);
        uint256 used = start - gasleft();
        emit GasUsed(used);
    }

    function transferOut(
        address token,
        address to,
        uint256 value
    ) public {
        uint256 start = gasleft();
        token.safeTransfer(to, value);
        uint256 used = start - gasleft();
        emit GasUsed(used);
    }
}
