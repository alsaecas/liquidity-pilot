// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { LiquidityPilot } from "../src/LiquidityPilot.sol";
import { MockV2Factory } from "../test/mocks/MockV2Factory.sol";
import { MockV2Router } from "../test/mocks/MockV2Router.sol";

contract DeployLocal is Script {
    function run()
        external
        returns (LiquidityPilot pilot, MockV2Router router, MockV2Factory factory)
    {
        vm.startBroadcast();
        factory = new MockV2Factory();
        router = new MockV2Router(address(factory));
        pilot = new LiquidityPilot(address(router), address(factory));
        vm.stopBroadcast();
    }
}
