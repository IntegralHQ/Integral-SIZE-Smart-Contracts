// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.7.6;

import '../libraries/SafeMath.sol';

contract FailingERC20 {
    using SafeMath for uint256;

    string public constant name = 'Failing Test Token';
    string public constant symbol = 'FTT';

    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balances;
    mapping(address => mapping(address => uint256)) public allowance;

    bool public revertBalanceOf;
    bool public wasteTransferGas;
    uint32 public revertAfter = uint32(-1);
    uint32 public totalTransfers;

    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor(uint256 _totalSupply) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        _mint(msg.sender, _totalSupply);
    }

    function _wasteGas(uint256 iterations) internal pure returns (uint256) {
        uint256 result = 2;
        for (uint256 i; i < iterations; ++i) {
            result += result**3;
        }
        return result;
    }

    function _mint(address to, uint256 value) internal {
        totalSupply = totalSupply.add(value);
        balances[to] = balances[to].add(value);
        emit Transfer(address(0), to, value);
    }

    function _approve(
        address owner,
        address spender,
        uint256 value
    ) private {
        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    function _transfer(
        address from,
        address to,
        uint256 value
    ) private {
        require(totalTransfers < revertAfter, 'FA_TRANSFER_OOPS');
        ++totalTransfers;
        if (wasteTransferGas) {
            _wasteGas(100000);
        }
        balances[from] = balances[from].sub(value);
        balances[to] = balances[to].add(value);
        emit Transfer(from, to, value);
    }

    function balanceOf(address owner) external view returns (uint256) {
        require(!revertBalanceOf, 'FA_BALANCE_OF_OOPS');
        return balances[owner];
    }

    function approve(address spender, uint256 value) external returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool) {
        if (allowance[from][msg.sender] != uint256(-1)) {
            allowance[from][msg.sender] = allowance[from][msg.sender].sub(value);
        }
        _transfer(from, to, value);
        return true;
    }

    function setRevertBalanceOf(bool value) external {
        revertBalanceOf = value;
    }

    function setWasteTransferGas(bool value) external {
        wasteTransferGas = value;
    }

    function setRevertAfter(uint32 value) external {
        revertAfter = value;
    }
}
