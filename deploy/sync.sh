#!/bin/bash
# ============================================================
# Quick sync - Upload changed files to S3 and invalidate cache
# Run this after making changes to deploy updates
# ============================================================

set -e

# Load config
if [ -f deploy/.env ]; then
  source deploy/.env
else
  echo "Error: deploy/.env not found. Run aws-setup.sh first."
  exit 1
fi

echo "Syncing files to s3://${BUCKET_NAME}..."

# Sync all site files
aws s3 sync . "s3://${BUCKET_NAME}" \
  --exclude ".git/*" \
  --exclude "deploy/*" \
  --exclude "node_modules/*" \
  --exclude "package.json" \
  --exclude "README.md" \
  --exclude ".gitignore" \
  --exclude "*.sh" \
  --delete \
  --cache-control "public, max-age=3600"

# Fix content types
aws s3 cp "s3://${BUCKET_NAME}" "s3://${BUCKET_NAME}" \
  --recursive --exclude "*" --include "*.js" \
  --content-type "application/javascript" \
  --metadata-directive REPLACE --cache-control "public, max-age=86400" --quiet

aws s3 cp "s3://${BUCKET_NAME}" "s3://${BUCKET_NAME}" \
  --recursive --exclude "*" --include "*.css" \
  --content-type "text/css" \
  --metadata-directive REPLACE --cache-control "public, max-age=86400" --quiet

# Invalidate CloudFront cache
echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id "${CF_DIST_ID}" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text

echo "Done! Changes will be live in ~1-2 minutes."
echo "Site: https://${DOMAIN}"
