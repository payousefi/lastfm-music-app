#!/bin/bash
#
# Build/deploy script for Last.fm Music App
# Copies production files to a local destination using rsync
#
# Usage: ./scripts/copy-to-server.sh [destination]
#
# If no destination is provided, prompts for one.
# Uses exclusion list - new files are automatically included.
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

# Files/directories to EXCLUDE from deployment
# Everything else is automatically included
EXCLUDES=(
    ".git"
    ".gitignore"
    ".prettierrc"
    "README.md"
    "scripts/copy-to-server.sh"
    ".DS_Store"
    "*.swp"
    "*~"
)

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

# Build rsync exclude arguments
RSYNC_EXCLUDES=""
for exclude in "${EXCLUDES[@]}"; do
    RSYNC_EXCLUDES="$RSYNC_EXCLUDES --exclude='$exclude'"
done

# Show what will be deployed
echo ""
echo -e "${YELLOW}Destination:${NC} $DEST_DIR"
echo ""
echo -e "${YELLOW}Excluded files:${NC}"
for exclude in "${EXCLUDES[@]}"; do
    echo "  - $exclude"
done
echo ""

# Preview what will be copied (dry run)
echo -e "${YELLOW}Files to copy:${NC}"
eval rsync -av --dry-run $RSYNC_EXCLUDES "$PROJECT_ROOT/" "$DEST_DIR/" 2>/dev/null | grep -v "^sending\|^total\|^$\|^\./$" | head -30
echo ""

# Ask about cleaning destination
echo -e "${YELLOW}Sync mode:${NC}"
echo "  y = Delete files in destination that don't exist in source (--delete)"
echo "  n = Just overwrite/add files (keeps any extra files)"
read -p "Use delete mode? (y/N) " -n 1 -r DELETE_MODE
echo ""

# Confirm
echo ""
read -p "Continue with deployment? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Build final rsync command
RSYNC_CMD="rsync -av"
if [[ $DELETE_MODE =~ ^[Yy]$ ]]; then
    RSYNC_CMD="$RSYNC_CMD --delete"
fi

# Copy files using rsync
echo ""
echo -e "${BLUE}Copying files...${NC}"
eval $RSYNC_CMD $RSYNC_EXCLUDES "$PROJECT_ROOT/" "$DEST_DIR/"

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
