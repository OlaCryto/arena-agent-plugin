#!/bin/bash
# Logiqical — One-click agent wallet setup
# Usage: curl -fsSL https://raw.githubusercontent.com/OlaCryto/arena-agent-plugin/master/install.sh | bash

set -e

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
DIM="\033[2m"
RESET="\033[0m"

echo ""
echo -e "${BOLD}  Logiqical Installer${RESET}"
echo -e "${DIM}  Agent wallet SDK for Avalanche + Arena${RESET}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${YELLOW}  Node.js not found.${RESET}"
  echo ""

  if command -v brew &> /dev/null; then
    echo "  Installing via Homebrew..."
    brew install node
  elif command -v apt-get &> /dev/null; then
    echo "  Installing via apt..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  elif command -v dnf &> /dev/null; then
    echo "  Installing via dnf..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo dnf install -y nodejs
  else
    echo "  Please install Node.js 18+ manually: https://nodejs.org"
    exit 1
  fi
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${YELLOW}  Node.js $NODE_VERSION found — version 18+ required.${RESET}"
  echo "  Please upgrade: https://nodejs.org"
  exit 1
fi

echo -e "  ${GREEN}Node.js $(node -v)${RESET}"

# Install logiqical
echo ""
echo "  Installing logiqical..."
npm install -g logiqical 2>&1 | tail -1

VERSION=$(node -e "console.log(require('logiqical/package.json').version)" 2>/dev/null || echo "latest")
echo -e "  ${GREEN}logiqical@${VERSION} installed${RESET}"

# Run setup
echo ""
echo -e "  Running ${BOLD}logiqical setup${RESET}..."
echo ""

logiqical setup

echo ""
echo -e "${GREEN}  Installation complete!${RESET}"
echo ""
echo "  Commands:"
echo -e "    ${BOLD}logiqical status${RESET}     Show agent status"
echo -e "    ${BOLD}logiqical wallet${RESET}     Show wallet info"
echo -e "    ${BOLD}logiqical policy${RESET}     View/edit spending policy"
echo -e "    ${BOLD}logiqical vault${RESET}      Start vault daemon"
echo -e "    ${BOLD}logiqical mcp${RESET}        Start MCP server"
echo ""
echo -e "  ${DIM}Or use the SDK:${RESET}"
echo -e "    ${BOLD}import { Logiqical } from 'logiqical'${RESET}"
echo ""
