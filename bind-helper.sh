#!/bin/bash

# NDash - Bind Management Helper Script
# Quick commands for managing Bind DNS zones

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  NDash - Bind Management Helper${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check Bind status
check_bind_status() {
    echo -e "${YELLOW}Checking Bind9 status...${NC}"
    sudo systemctl status bind9 --no-pager | grep "Active:"
    echo ""
}

# Function to reload Bind
reload_bind() {
    echo -e "${YELLOW}Reloading Bind9...${NC}"
    sudo rndc reload
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Bind reloaded successfully${NC}"
    else
        echo -e "${RED}✗ Failed to reload Bind${NC}"
    fi
    echo ""
}

# Function to check config
check_config() {
    echo -e "${YELLOW}Checking Bind configuration...${NC}"
    sudo named-checkconf
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Configuration is valid${NC}"
    else
        echo -e "${RED}✗ Configuration has errors${NC}"
    fi
    echo ""
}

# Function to list zones
list_zones() {
    echo -e "${YELLOW}Zones in configuration:${NC}"
    grep -A 2 'zone "' /etc/bind/named.conf.local | grep 'zone "' | sed 's/zone "\(.*\)".*/\1/'
    echo ""
    
    echo -e "${YELLOW}Zone files in directory:${NC}"
    ls -lh /etc/bind/zones/
    echo ""
}

# Function to test zone
test_zone() {
    if [ -z "$1" ]; then
        echo -e "${RED}Usage: $0 test-zone <zone-name>${NC}"
        return 1
    fi
    
    local zone=$1
    local zone_file="/etc/bind/zones/db.$zone"
    
    echo -e "${YELLOW}Testing zone: $zone${NC}"
    
    if [ ! -f "$zone_file" ]; then
        echo -e "${RED}✗ Zone file not found: $zone_file${NC}"
        return 1
    fi
    
    sudo named-checkzone "$zone" "$zone_file"
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Zone syntax is valid${NC}"
        echo ""
        echo -e "${YELLOW}DNS Resolution test:${NC}"
        dig @localhost "$zone" SOA +short
        dig @localhost "$zone" NS +short
        dig @localhost "$zone" A +short
    else
        echo -e "${RED}✗ Zone syntax has errors${NC}"
    fi
    echo ""
}

# Function to view zone file
view_zone() {
    if [ -z "$1" ]; then
        echo -e "${RED}Usage: $0 view-zone <zone-name>${NC}"
        return 1
    fi
    
    local zone=$1
    local zone_file="/etc/bind/zones/db.$zone"
    
    if [ ! -f "$zone_file" ]; then
        echo -e "${RED}✗ Zone file not found: $zone_file${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}Zone file: $zone_file${NC}"
    echo -e "${BLUE}----------------------------------------${NC}"
    cat "$zone_file"
    echo -e "${BLUE}----------------------------------------${NC}"
    echo ""
}

# Function to view Bind logs
view_logs() {
    echo -e "${YELLOW}Recent Bind9 logs (last 50 lines):${NC}"
    echo -e "${BLUE}----------------------------------------${NC}"
    sudo journalctl -u bind9 -n 50 --no-pager
    echo -e "${BLUE}----------------------------------------${NC}"
    echo ""
}

# Function to backup zones
backup_zones() {
    local backup_dir="/opt/ndash/backups"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/zones_backup_$timestamp.tar.gz"
    
    mkdir -p "$backup_dir"
    
    echo -e "${YELLOW}Creating backup...${NC}"
    sudo tar -czf "$backup_file" /etc/bind/zones/ /etc/bind/named.conf.local
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Backup created: $backup_file${NC}"
        ls -lh "$backup_file"
    else
        echo -e "${RED}✗ Backup failed${NC}"
    fi
    echo ""
}

# Function to fix permissions
fix_permissions() {
    echo -e "${YELLOW}Fixing permissions...${NC}"
    sudo chown -R bind:bind /etc/bind/zones/
    sudo chmod 755 /etc/bind/zones/
    sudo chmod 644 /etc/bind/zones/*
    sudo chmod 644 /etc/bind/named.conf.local
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Permissions fixed${NC}"
    else
        echo -e "${RED}✗ Failed to fix permissions${NC}"
    fi
    echo ""
}

# Function to show statistics
show_stats() {
    echo -e "${YELLOW}Bind Statistics:${NC}"
    echo ""
    
    echo -e "${BLUE}Total zones:${NC}"
    grep -c 'zone "' /etc/bind/named.conf.local
    
    echo -e "${BLUE}Zone files:${NC}"
    ls /etc/bind/zones/ | wc -l
    
    echo -e "${BLUE}Bind uptime:${NC}"
    sudo systemctl show bind9 -p ActiveEnterTimestamp | cut -d= -f2
    
    echo -e "${BLUE}Memory usage:${NC}"
    ps aux | grep named | grep -v grep | awk '{print $4"%"}'
    
    echo ""
}

# Main menu
case "$1" in
    status)
        check_bind_status
        ;;
    reload)
        reload_bind
        ;;
    check)
        check_config
        ;;
    list)
        list_zones
        ;;
    test-zone)
        test_zone "$2"
        ;;
    view-zone)
        view_zone "$2"
        ;;
    logs)
        view_logs
        ;;
    backup)
        backup_zones
        ;;
    fix-perms)
        fix_permissions
        ;;
    stats)
        show_stats
        ;;
    *)
        echo -e "${YELLOW}Usage:${NC}"
        echo "  $0 status         - Check Bind service status"
        echo "  $0 reload         - Reload Bind configuration"
        echo "  $0 check          - Validate Bind configuration"
        echo "  $0 list           - List all zones"
        echo "  $0 test-zone <name> - Test zone syntax and resolution"
        echo "  $0 view-zone <name> - View zone file content"
        echo "  $0 logs           - View Bind logs"
        echo "  $0 backup         - Backup all zones"
        echo "  $0 fix-perms      - Fix file permissions"
        echo "  $0 stats          - Show Bind statistics"
        echo ""
        echo -e "${YELLOW}Examples:${NC}"
        echo "  $0 status"
        echo "  $0 test-zone example.local"
        echo "  $0 view-zone example.local"
        echo ""
        ;;
esac
