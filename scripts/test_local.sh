#!/bin/bash

# Base URL
API_URL="http://localhost:3000/api/v1"
API_KEY="dev-admin-key"

echo "🚀 Starting Local Test..."
echo "--------------------------------"

# 1. Create Wallet (Requires ADMIN role)
echo "1️⃣  Creating a new wallet..."
RESPONSE=$(curl -s -X POST "$API_URL/wallets" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"label": "Local Test Wallet"}')

echo "Response: $RESPONSE"

# Extract Address (using grep/sed for simplicity, assuming simple JSON structure)
ADDRESS=$(echo $RESPONSE | grep -o '"address":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADDRESS" ]; then
  echo "❌ Failed to create wallet or extract address."
  exit 1
fi

echo "✅ Wallet Created: $ADDRESS"
echo "--------------------------------"

# 2. Get Wallet Details (Requires OPERATOR role)
echo "2️⃣  Fetching wallet details..."
curl -s -X GET "$API_URL/wallets/$ADDRESS" \
  -H "x-api-key: $API_KEY"

echo ""
echo "--------------------------------"

# 3. Check ERC20 Balance (Requires OPERATOR role)
# Using a known USDC address on Sepolia (example)
USDC_ADDRESS="0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" 

echo "3️⃣  Checking USDC Balance (Sepolia)..."
curl -s -X GET "$API_URL/wallets/$ADDRESS/erc20/balance?tokenAddress=$USDC_ADDRESS" \
  -H "x-api-key: $API_KEY"

echo ""
echo "--------------------------------"
echo "🎉 Test Complete!"
