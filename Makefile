SHELL := /bin/bash

.PHONY: install build test test-fork coverage frontend-install frontend-dev frontend-build check local-anvil deploy-local

install: frontend-install
	forge install

build:
	forge build

test:
	forge test --match-path "test/unit/*" -vvv

test-fork:
	@test -n "$$ARBITRUM_RPC_URL" || (echo "ARBITRUM_RPC_URL is required" && exit 1)
	forge test --match-path "test/fork/*" --fork-url "$$ARBITRUM_RPC_URL" -vvv

coverage:
	forge coverage --match-path "test/unit/*" --report summary --ir-minimum

frontend-install:
	cd frontend && corepack pnpm install --frozen-lockfile

frontend-dev:
	cd frontend && corepack pnpm dev

frontend-build:
	cd frontend && corepack pnpm build

check:
	forge fmt --check
	forge build
	forge test --match-path "test/unit/*"
	cd frontend && corepack pnpm lint
	cd frontend && corepack pnpm typecheck
	cd frontend && corepack pnpm test
	cd frontend && corepack pnpm build

local-anvil:
	@test -n "$$ARBITRUM_RPC_URL" || (echo "ARBITRUM_RPC_URL is required" && exit 1)
	anvil --fork-url "$$ARBITRUM_RPC_URL"

deploy-local:
	forge script script/DeployLocal.s.sol:DeployLocal --rpc-url http://127.0.0.1:8545 --broadcast
