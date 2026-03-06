#!/bin/bash

# Test script for Identity Reconciliation API

BASE_URL="http://localhost:3000"

echo "🚀 Testing Identity Reconciliation Service"
echo "=========================================="

# Test 1: Health Check
echo ""
echo "Test 1: Health Check"
curl -s "$BASE_URL/health" | jq . 2>/dev/null || curl -s "$BASE_URL/health"

# Test 2: Create new primary contact
echo ""
echo "Test 2: Create new primary contact"
curl -s -X POST "$BASE_URL/identify" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","phoneNumber":"+1111111111"}' | jq . 2>/dev/null

# Test 3: Exact match (same email and phone)
echo ""
echo "Test 3: Exact match"
curl -s -X POST "$BASE_URL/identify" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","phoneNumber":"+1111111111"}' | jq . 2>/dev/null

# Test 4: Partial match (same phone, new email)
echo ""
echo "Test 4: Partial match - new email with existing phone"
curl -s -X POST "$BASE_URL/identify" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice.newmail@example.com","phoneNumber":"+1111111111"}' | jq . 2>/dev/null

# Test 5: Create second primary
echo ""
echo "Test 5: Create second primary contact"
curl -s -X POST "$BASE_URL/identify" \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","phoneNumber":"+2222222222"}' | jq . 2>/dev/null

# Test 6: Merge two clusters
echo ""
echo "Test 6: Merge two clusters (email from Alice's cluster, phone from Bob's cluster)"
curl -s -X POST "$BASE_URL/identify" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","phoneNumber":"+2222222222"}' | jq . 2>/dev/null

echo ""
echo "=========================================="
echo "✅ Tests completed!"
