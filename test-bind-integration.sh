#!/bin/bash

# NDash Bind Integration Test Script
# Tests the integration between NDash and Bind9 DNS Server

echo "🧪 NDash Bind Integration Test"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test result
test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        ((TESTS_FAILED++))
    fi
}

echo "1. Checking Bind9 Installation..."
if command -v named &> /dev/null; then
    test_result 0 "Bind9 is installed"
    named -v
else
    test_result 1 "Bind9 is not installed"
fi
echo ""

echo "2. Checking Bind9 Service Status..."
if systemctl is-active --quiet named; then
    test_result 0 "Bind9 service is running"
else
    test_result 1 "Bind9 service is not running"
fi
echo ""

echo "3. Checking Directory Permissions..."
if [ -d "/etc/bind/zones" ]; then
    test_result 0 "Zones directory exists"
    ls -la /etc/bind/zones
else
    echo -e "${YELLOW}⚠ WARNING${NC}: Zones directory doesn't exist, creating..."
    sudo mkdir -p /etc/bind/zones
    sudo chown bind:bind /etc/bind/zones
    test_result 0 "Zones directory created"
fi
echo ""

echo "4. Checking Bind Configuration Files..."
if [ -f "/etc/bind/named.conf.local" ]; then
    test_result 0 "named.conf.local exists"
else
    test_result 1 "named.conf.local not found"
fi
echo ""

echo "5. Testing Zone File Creation..."
TEST_ZONE="test-ndash.local"
TEST_ZONE_FILE="/etc/bind/zones/db.$TEST_ZONE"

# Create test zone file
sudo bash -c "cat > $TEST_ZONE_FILE" << 'EOF'
; Test zone file created by NDash
$TTL 3600
@       IN      SOA     ns1.test-ndash.local. admin.test-ndash.local. (
                        2024111401 ; Serial
                        86400      ; Refresh
                        7200       ; Retry
                        3600000    ; Expire
                        86400 )    ; Minimum TTL

; Name servers
@       IN      NS      ns1.test-ndash.local.

; A records
@       IN      A       192.168.100.1
ns1     IN      A       192.168.100.1
www     IN      A       192.168.100.10
EOF

if [ -f "$TEST_ZONE_FILE" ]; then
    test_result 0 "Test zone file created"
else
    test_result 1 "Failed to create test zone file"
fi
echo ""

echo "6. Testing Zone File Syntax..."
if sudo named-checkzone "$TEST_ZONE" "$TEST_ZONE_FILE" > /dev/null 2>&1; then
    test_result 0 "Zone file syntax is valid"
    sudo named-checkzone "$TEST_ZONE" "$TEST_ZONE_FILE"
else
    test_result 1 "Zone file syntax is invalid"
fi
echo ""

echo "7. Testing Bind Configuration..."
if sudo named-checkconf /etc/bind/named.conf > /dev/null 2>&1; then
    test_result 0 "Bind configuration is valid"
else
    test_result 1 "Bind configuration has errors"
fi
echo ""

echo "8. Testing rndc (Bind Control)..."
if sudo rndc status > /dev/null 2>&1; then
    test_result 0 "rndc is working"
    sudo rndc status
else
    test_result 1 "rndc is not working"
fi
echo ""

echo "9. Testing Zone Reload..."
if sudo rndc reload > /dev/null 2>&1; then
    test_result 0 "Bind reload successful"
else
    test_result 1 "Bind reload failed"
fi
echo ""

echo "10. Checking NDash Application..."
if [ -f "/opt/ndash/server.js" ]; then
    test_result 0 "NDash application found"
else
    test_result 1 "NDash application not found"
fi
echo ""

echo "11. Checking Node.js..."
if command -v node &> /dev/null; then
    test_result 0 "Node.js is installed"
    node --version
else
    test_result 1 "Node.js is not installed"
fi
echo ""

echo "12. Checking NDash Dependencies..."
if [ -d "/opt/ndash/node_modules" ]; then
    test_result 0 "NPM dependencies installed"
else
    test_result 1 "NPM dependencies not installed"
fi
echo ""

# Cleanup test zone
echo "13. Cleaning up test files..."
if [ -f "$TEST_ZONE_FILE" ]; then
    sudo rm -f "$TEST_ZONE_FILE"
    test_result 0 "Test zone file removed"
fi
echo ""

# Summary
echo "================================"
echo "Test Summary:"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Bind integration is ready!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Please check the errors above.${NC}"
    exit 1
fi
