#!/bin/bash
set -e

echo "Running build check..."
npm run build

echo ""
echo "Build passed! Pushing..."
git ps -f
