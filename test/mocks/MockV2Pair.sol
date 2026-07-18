// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { MockERC20 } from "./MockERC20.sol";

contract MockV2Pair is MockERC20 {
    address public immutable token0;
    address public immutable token1;

    constructor(address token0_, address token1_) MockERC20("Mock V2 LP", "MV2-LP", 18) {
        token0 = token0_;
        token1 = token1_;
    }
}
