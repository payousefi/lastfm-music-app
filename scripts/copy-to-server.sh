#!/bin/bash
#
# Build/deploy script for Last.fm Music App
# Copies production files to a local destination
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

# Files/directories to EXCLUDE from deployment (relative to project root)
# Everything else is automatically included
EXCLUDES=(
    ".git"
    ".gitignore"
    ".prettierrc"
    "README.md"
    "scripts/copy-to-server.sh"
)

# Function to check if a path should be excluded
should_exclude() {
    local path="$1"
    for exclude in "${EXCLUDES[@]}"; do
        if [[ "$path" == "$exclude" || "$path" == "$exclude/"* ]]; then
            return 0  # true, should exclude
        fi
    done
    return 1  # false, should not exclude
}

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

# Build list of files to copy
cd "$PROJECT_ROOT"
FILES_TO_COPY=()
while IFS= read -r -d '' file; do
    # Get relative path
    rel_path="${file#./}"
    
    # Skip excluded files
    if should_exclude "$rel_path"; then
        continue
    fi
    
    # Skip hidden files (except specific ones we want)
    basename=$(basename "$rel_path")
    if [[ "$basename" == .* && "$basename" != ".htaccess" ]]; then
        continue
    fi
    
    FILES_TO_COPY+=("$rel_path")
done < <(find . -type f -print0)

# Show what will be deployed
echo ""
echo -e "${YELLOW}Destination:${NC} $DEST_DIR"
echo ""
echo -e "${YELLOW}Excluded:${NC}"
for exclude in "${EXCLUDES[@]}"; do
    echo "  - $exclude"
done
echo ""
echo -e "${YELLOW}Files to copy (${#FILES_TO_COPY[@]} files):${NC}"
for file in "${FILES_TO_COPY[@]}"; do
    echo "  $file"
done
echo ""

# Ask about cleaning destination
echo -e "${YELLOW}Clean destination first?${NC}"
echo "  y = Delete ALL existing files, then copy fresh (recommended)"
echo "  n = Just overwrite/add files (keeps any extra files)"
read -p "Clean first? (y/N) " -n 1 -r CLEAN_FIRST
echo ""

# Confirm
echo ""
read -p "Continue with deployment? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Clean destination if requested
if [[ $CLEAN_FIRST =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${BLUE}Cleaning destination...${NC}"
    rm -rf "${DEST_DIR:?}"/*
fi

# Copy files
echo ""
echo -e "${BLUE}Copying files...${NC}"

for file in "${FILES_TO_COPY[@]}"; do
    # Create directory structure if needed
    dir=$(dirname "$file")
    if [ "$dir" != "." ]; then
        mkdir -p "$DEST_DIR/$dir"
    fi
    
    # Copy the file
    cp "$PROJECT_ROOT/$file" "$DEST_DIR/$file"
    echo "  Copied: $file"
done

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
