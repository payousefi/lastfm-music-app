#!/bin/bash
#
# Build/deploy script for Last.fm Music App
# Copies production files to a local destination
#
# Usage: ./scripts/copy-to-server.sh [destination]
#
# If no destination is provided, prompts for one.
#

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Last.fm Music App - Build Script     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Get destination from argument or prompt
DEST_DIR="$1"
if [ -z "$DEST_DIR" ]; then
    echo -e "${YELLOW}Enter destination path:${NC}"
    echo "(path to the directory where files should be copied)"
    echo ""
    read -p "Destination: " DEST_DIR
fi

if [ -z "$DEST_DIR" ]; then
    echo -e "${RED}Error: Destination path is required${NC}"
    exit 1
fi

# Check if destination exists
if [ ! -d "$DEST_DIR" ]; then
    echo -e "${YELLOW}Destination doesn't exist. Create it? (y/N)${NC}"
    read -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        mkdir -p "$DEST_DIR"
    else
        echo -e "${RED}Error: Destination path does not exist${NC}"
        exit 1
    fi
fi

# Show what will be deployed
echo ""
echo -e "${YELLOW}Destination:${NC} $DEST_DIR"
echo ""
echo "Files to copy:"
echo "  index.php"
echo "  favicon.ico"
echo "  robots.txt"
echo "  img/og-image.png"
echo "  stylesheets/reset.css"
echo "  stylesheets/main.css"
echo "  scripts/app.js"
echo "  scripts/personality-headlines.js"
echo ""

# Confirm
read -p "Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Copy files
echo ""
echo -e "${BLUE}Copying files...${NC}"

# Root files
cp "$PROJECT_ROOT/index.php" "$DEST_DIR/"
cp "$PROJECT_ROOT/favicon.ico" "$DEST_DIR/"
cp "$PROJECT_ROOT/robots.txt" "$DEST_DIR/"

# Images
mkdir -p "$DEST_DIR/img"
cp "$PROJECT_ROOT/img/og-image.png" "$DEST_DIR/img/"

# Stylesheets
mkdir -p "$DEST_DIR/stylesheets"
cp "$PROJECT_ROOT/stylesheets/reset.css" "$DEST_DIR/stylesheets/"
cp "$PROJECT_ROOT/stylesheets/main.css" "$DEST_DIR/stylesheets/"

# Scripts (only production JS)
mkdir -p "$DEST_DIR/scripts"
cp "$PROJECT_ROOT/scripts/app.js" "$DEST_DIR/scripts/"
cp "$PROJECT_ROOT/scripts/personality-headlines.js" "$DEST_DIR/scripts/"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Build Complete!              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Files copied to: $DEST_DIR"
echo ""

# Show total size
TOTAL_SIZE=$(du -sh "$DEST_DIR" 2>/dev/null | cut -f1)
echo "Total size: $TOTAL_SIZE"
