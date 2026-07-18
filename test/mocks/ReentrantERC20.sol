// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { MockERC20 } from "./MockERC20.sol";

contract ReentrantERC20 is MockERC20 {
    address public callbackTarget;
    bytes public callbackData;
    bool public callbackSucceeded;

    constructor() MockERC20("Reentrant Token", "REENT", 18) { }

    function configureCallback(address target, bytes calldata data) external {
        callbackTarget = target;
        callbackData = data;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (callbackTarget != address(0)) {
            (callbackSucceeded,) = callbackTarget.call(callbackData);
        }
        return super.transferFrom(from, to, value);
    }
}
