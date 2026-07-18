// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { LiquidityPilot } from "../src/LiquidityPilot.sol";

contract DeployArbitrum is Script {
    address internal constant ROUTER = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    address internal constant FACTORY = 0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9;

    function run() external returns (LiquidityPilot pilot) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        pilot = new LiquidityPilot(ROUTER, FACTORY);
        vm.stopBroadcast();
    }
}
