#!/usr/bin/env bash
# Builds both Soroban contracts to WASM. steward-reputation builds first
# because library-registry imports its WASM interface at compile time.
set -e

echo "==> Building steward-reputation"
cd contracts/steward-reputation
stellar contract build
cd ../..

echo "==> Building library-registry"
cd contracts/library-registry
stellar contract build
cd ../..

echo "==> Optimizing WASM"
stellar contract optimize \
  --wasm target/wasm32-unknown-unknown/release/steward_reputation.wasm
stellar contract optimize \
  --wasm target/wasm32-unknown-unknown/release/library_registry.wasm

echo "Build complete. Artifacts in target/wasm32-unknown-unknown/release/"
