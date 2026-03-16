#!/bin/bash
# Cadence - Automated Google Cloud Run Deployment
# Usage: ./deploy.sh
# Requires: gcloud CLI authenticated with appropriate project permissions

set -euo pipefail

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-gen-lang-client-0977515736}"
REGION="${CLOUD_RUN_REGION:-us-central1}"
SERVICE_NAME="cadence"

echo "Deploying Cadence to Google Cloud Run..."
echo "  Project: $PROJECT_ID"
echo "  Region:  $REGION"
echo "  Service: $SERVICE_NAME"

# Deploy from source (Cloud Build + Cloud Run)
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8000 \
  --session-affinity \
  --timeout 3600 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID" \
  --min-instances 0 \
  --max-instances 3 \
  --memory 512Mi \
  --cpu 1

# Get the service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format "value(status.url)")

echo ""
echo "Deployment complete!"
echo "Service URL: $SERVICE_URL"
echo "Health check: $SERVICE_URL/health"
