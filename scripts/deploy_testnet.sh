#!/usr/bin/env bash
# Deploys StewardReputation then LibraryRegistry to Stellar Testnet,
# wires them together, and prints everything needed for the submission
# checklist.
#
# Prerequisites:
#   1. Stellar CLI installed: https://developers.stellar.org/docs/tools/cli
#   2. A funded identity: stellar keys generate deployer --network testnet --fund
#   3. Run scripts/build.sh first.
set -e

NETWORK="testnet"
DEPLOYER="deployer"

echo "==> Deploying StewardReputation"
REPUTATION_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/steward_reputation.optimized.wasm \
  --source "$DEPLOYER" \
  --network "$NETWORK")
echo "StewardReputation deployed at: $REPUTATION_ID"

echo "==> Deploying LibraryRegistry"
REGISTRY_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/library_registry.optimized.wasm \
  --source "$DEPLOYER" \
  --network "$NETWORK")
echo "LibraryRegistry deployed at: $REGISTRY_ID"

DEPLOYER_ADDRESS=$(stellar keys address "$DEPLOYER")

echo "==> Initializing StewardReputation"
stellar contract invoke \
  --id "$REPUTATION_ID" --source "$DEPLOYER" --network "$NETWORK" \
  -- initialize --admin "$DEPLOYER_ADDRESS"

echo "==> Using native XLM SAC as the deposit token"
TOKEN_ID=$(stellar contract id asset --asset native --network "$NETWORK")
echo "Native token contract: $TOKEN_ID"

echo "==> Initializing LibraryRegistry"
stellar contract invoke \
  --id "$REGISTRY_ID" --source "$DEPLOYER" --network "$NETWORK" \
  -- initialize \
  --admin "$DEPLOYER_ADDRESS" \
  --token_address "$TOKEN_ID" \
  --reputation_address "$REPUTATION_ID"

echo "==> Authorizing LibraryRegistry as a trusted writer on the reputation contract"
stellar contract invoke \
  --id "$REPUTATION_ID" --source "$DEPLOYER" --network "$NETWORK" \
  -- authorize_writer --writer "$REGISTRY_ID"

echo ""
echo "=========================================="
echo " DEPLOYMENT COMPLETE"
echo "=========================================="
echo "StewardReputation: $REPUTATION_ID"
echo "LibraryRegistry:   $REGISTRY_ID"
echo "Deposit token (XLM): $TOKEN_ID"
echo ""
echo "Save these into frontend/.env.local — see .env.example"
echo ""
echo "Sample flow to generate a tx hash for your submission:"
echo ""
echo "stellar contract invoke --id $REGISTRY_ID --source $DEPLOYER --network $NETWORK \\"
echo "  -- register_box --steward $DEPLOYER_ADDRESS \\"
echo "  --name \"Maple Street Box\" --neighborhood \"Riverside\""
