#!/bin/bash

# Auto-push script for MarketAtomy Tailkit
# Usage: ./push-to-remote.sh "commit message"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if commit message is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Commit message is required${NC}"
    echo "Usage: ./push-to-remote.sh \"your commit message\""
    exit 1
fi

COMMIT_MSG="$1"

echo -e "${YELLOW}Starting git push process...${NC}"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}Error: Not a git repository${NC}"
    exit 1
fi

# Check if there are changes to commit
if git diff --quiet && git diff --cached --quiet; then
    echo -e "${YELLOW}No changes to commit${NC}"
    exit 0
fi

# Stage all changes
echo -e "${YELLOW}Staging all changes...${NC}"
git add -A

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to stage changes${NC}"
    exit 1
fi

# Commit changes
echo -e "${YELLOW}Committing changes...${NC}"
git commit -m "$COMMIT_MSG"

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to commit changes${NC}"
    exit 1
fi

# Push to remote
echo -e "${YELLOW}Pushing to remote...${NC}"
git push origin main

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to push to remote${NC}"
    exit 1
fi

echo -e "${GREEN}Successfully pushed to remote!${NC}"
exit 0
