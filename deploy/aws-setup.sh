#!/bin/bash
# ============================================================
# WinEarnMoney - AWS Deployment Script
# Deploys static site to S3 + CloudFront + Route53
# ============================================================
#
# PREREQUISITES:
#   1. AWS CLI installed and configured (aws configure)
#   2. A registered domain (either in Route53 or transfer DNS)
#   3. Replace YOUR_DOMAIN below with your actual domain
#
# USAGE:
#   chmod +x deploy/aws-setup.sh
#   ./deploy/aws-setup.sh
#
# ============================================================

set -e

# ===== CONFIGURATION - EDIT THESE =====
DOMAIN="playrealmoneygames.com"      # Your domain
REGION="us-east-1"                   # Must be us-east-1 for CloudFront + ACM
BUCKET_NAME="${DOMAIN}"
WWW_BUCKET="www.${DOMAIN}"
# ======================================

echo "============================================"
echo "  WinEarnMoney AWS Deployment"
echo "  Domain: ${DOMAIN}"
echo "  Region: ${REGION}"
echo "============================================"
echo ""

# Step 1: Create S3 bucket for static hosting
echo "[1/7] Creating S3 bucket: ${BUCKET_NAME}"
aws s3api create-bucket \
  --bucket "${BUCKET_NAME}" \
  --region "${REGION}" \
  2>/dev/null || echo "  Bucket may already exist, continuing..."

# Step 2: Configure bucket for static website hosting
echo "[2/7] Configuring static website hosting"
aws s3 website "s3://${BUCKET_NAME}" \
  --index-document index.html \
  --error-document index.html

# Step 3: Set bucket policy for public read
echo "[3/7] Setting bucket policy (public read)"
aws s3api put-bucket-policy \
  --bucket "${BUCKET_NAME}" \
  --policy "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Sid\": \"PublicReadGetObject\",
      \"Effect\": \"Allow\",
      \"Principal\": \"*\",
      \"Action\": \"s3:GetObject\",
      \"Resource\": \"arn:aws:s3:::${BUCKET_NAME}/*\"
    }]
  }"

# Disable block public access
aws s3api put-public-access-block \
  --bucket "${BUCKET_NAME}" \
  --public-access-block-configuration \
  "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# Step 4: Upload site files
echo "[4/7] Uploading site files to S3"
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

# Set correct content types for JS and CSS
aws s3 cp "s3://${BUCKET_NAME}" "s3://${BUCKET_NAME}" \
  --recursive \
  --exclude "*" \
  --include "*.js" \
  --content-type "application/javascript" \
  --metadata-directive REPLACE \
  --cache-control "public, max-age=86400"

aws s3 cp "s3://${BUCKET_NAME}" "s3://${BUCKET_NAME}" \
  --recursive \
  --exclude "*" \
  --include "*.css" \
  --content-type "text/css" \
  --metadata-directive REPLACE \
  --cache-control "public, max-age=86400"

# Step 5: Request SSL Certificate
echo "[5/7] Requesting SSL certificate for ${DOMAIN}"
echo "  NOTE: You must validate the certificate via DNS or email."
echo "  This will output a CertificateArn - save it!"

CERT_ARN=$(aws acm request-certificate \
  --domain-name "${DOMAIN}" \
  --subject-alternative-names "*.${DOMAIN}" \
  --validation-method DNS \
  --region us-east-1 \
  --query 'CertificateArn' \
  --output text)

echo "  Certificate ARN: ${CERT_ARN}"
echo ""
echo "  ⚠️  IMPORTANT: Validate the certificate!"
echo "  Run: aws acm describe-certificate --certificate-arn ${CERT_ARN} --region us-east-1"
echo "  Then add the CNAME record shown to your DNS."
echo "  Wait for status to be ISSUED before proceeding."
echo ""
read -p "  Press Enter once certificate is validated (status: ISSUED)..."

# Step 6: Create CloudFront distribution
echo "[6/7] Creating CloudFront distribution"
CF_DIST_ID=$(aws cloudfront create-distribution \
  --distribution-config "{
    \"CallerReference\": \"${DOMAIN}-$(date +%s)\",
    \"Comment\": \"WinEarnMoney - ${DOMAIN}\",
    \"Enabled\": true,
    \"DefaultCacheBehavior\": {
      \"TargetOriginId\": \"S3-${BUCKET_NAME}\",
      \"ViewerProtocolPolicy\": \"redirect-to-https\",
      \"AllowedMethods\": {\"Quantity\": 2, \"Items\": [\"GET\", \"HEAD\"]},
      \"CachedMethods\": {\"Quantity\": 2, \"Items\": [\"GET\", \"HEAD\"]},
      \"ForwardedValues\": {
        \"QueryString\": true,
        \"Cookies\": {\"Forward\": \"none\"}
      },
      \"MinTTL\": 0,
      \"DefaultTTL\": 3600,
      \"MaxTTL\": 86400,
      \"Compress\": true
    },
    \"Origins\": {
      \"Quantity\": 1,
      \"Items\": [{
        \"Id\": \"S3-${BUCKET_NAME}\",
        \"DomainName\": \"${BUCKET_NAME}.s3-website-${REGION}.amazonaws.com\",
        \"CustomOriginConfig\": {
          \"HTTPPort\": 80,
          \"HTTPSPort\": 443,
          \"OriginProtocolPolicy\": \"http-only\"
        }
      }]
    },
    \"DefaultRootObject\": \"index.html\",
    \"Aliases\": {
      \"Quantity\": 2,
      \"Items\": [\"${DOMAIN}\", \"www.${DOMAIN}\"]
    },
    \"ViewerCertificate\": {
      \"ACMCertificateArn\": \"${CERT_ARN}\",
      \"SSLSupportMethod\": \"sni-only\",
      \"MinimumProtocolVersion\": \"TLSv1.2_2021\"
    },
    \"CustomErrorResponses\": {
      \"Quantity\": 1,
      \"Items\": [{
        \"ErrorCode\": 404,
        \"ResponseCode\": 200,
        \"ResponsePagePath\": \"/index.html\",
        \"ErrorCachingMinTTL\": 300
      }]
    }
  }" \
  --query 'Distribution.Id' \
  --output text)

CF_DOMAIN=$(aws cloudfront get-distribution \
  --id "${CF_DIST_ID}" \
  --query 'Distribution.DomainName' \
  --output text)

echo "  CloudFront Distribution ID: ${CF_DIST_ID}"
echo "  CloudFront Domain: ${CF_DOMAIN}"

# Step 7: DNS setup instructions
echo ""
echo "[7/7] DNS Setup"
echo "============================================"
echo ""
echo "Add these DNS records to your domain:"
echo ""
echo "  Type   Name              Value"
echo "  ----   ----              -----"
echo "  A      ${DOMAIN}         → ${CF_DOMAIN} (ALIAS record)"
echo "  CNAME  www.${DOMAIN}     → ${CF_DOMAIN}"
echo ""
echo "If using Route 53:"
echo "  aws route53 change-resource-record-sets \\"
echo "    --hosted-zone-id YOUR_ZONE_ID \\"
echo "    --change-batch '{\"Changes\":[{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{\"Name\":\"${DOMAIN}\",\"Type\":\"A\",\"AliasTarget\":{\"HostedZoneId\":\"Z2FDTNDATAQYW2\",\"DNSName\":\"${CF_DOMAIN}\",\"EvaluateTargetHealth\":false}}}]}'"
echo ""
echo "============================================"
echo "  DEPLOYMENT COMPLETE!"
echo "  Site: https://${DOMAIN}"
echo "  CloudFront: https://${CF_DOMAIN}"
echo "  S3: http://${BUCKET_NAME}.s3-website-${REGION}.amazonaws.com"
echo "============================================"

# Save config for future deploys
cat > deploy/.env <<EOF
DOMAIN=${DOMAIN}
REGION=${REGION}
BUCKET_NAME=${BUCKET_NAME}
CERT_ARN=${CERT_ARN}
CF_DIST_ID=${CF_DIST_ID}
CF_DOMAIN=${CF_DOMAIN}
EOF

echo ""
echo "Config saved to deploy/.env for future deploys."
echo "To update the site, run: ./deploy/sync.sh"
