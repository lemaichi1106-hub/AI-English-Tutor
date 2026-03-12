#!/bin/bash
# 🛡️ Secure Podman Build Script for OpenShift (DevSecOps)
set -e  # Exit on error

echo "🔒 Starting secure container build process..."

# Configure podman registry settings
REGISTRY_AUTH='basic'
IMAGE_NAME="ai-english-tutor"
IMAGE_TAG="${CI_COMMIT_SHA:-latest}"

# Pull base image securely
echo "📦 Pulling base images..."
podman pull --platform linux/amd64 node:20-alpine

# Clean up unused volumes (security best practice)
echo "🧹 Cleaning unused containers/volumes..."
podman system prune -af -f 2>/dev/null || true

# Build with multi-stage for smaller, secure image
echo "🔨 Building multi-stage production image..."
PODMAN_BUILD_OPTS=("--squash" "-t" "$IMAGE_NAME:$IMAGE_TAG" "-f" "Dockerfile" ".")

if podman build ${PODMAN_BUILD_OPTS[@]}; then
    echo "✅ Build successful! Image: $IMAGE_NAME:$IMAGE_TAG"
else
    echo "❌ Build failed!"
    exit 1
fi

# 🛡️ Security scan with Trivy (if available)
echo "🔍 Scanning image for vulnerabilities..."

if command -v trivy &> /dev/null; then
    SCAN_OUTPUT=$(trivy image --format table $IMAGE_NAME:$IMAGE_TAG 2>&1 || true)
    echo "$SCAN_OUTPUT" | tee scan-results.txt
    
    # Check if critical/high vulnerabilities exist
    if grep -q "CRITICAL\|HIGH" scan-results.txt; then
        echo "🚨 CRITICAL/VULNERABILITIES DETECTED!"
        exit 1
    fi
else
    echo "⚠️ Trivy not installed, skipping vulnerability scan."
fi

# 🏷️ Push to container registry (OpenShift Image Registry or external)
echo "📤 Pushing image to registry..."
if [[ "$OPENSHIFT_REGISTRY" == *"${OC_PROJECT:-default}"* ]]; then
    # Internal OpenShift registry
    podman push --authfile ~/.docker/config.json $IMAGE_NAME:$IMAGE_TAG oci://$OPENSHIFT_REGISTRY/namespace/$IMAGE_NAME:$IMAGE_TAG
else
    # External registry (Docker Hub, Quay, etc.)
    podman push --authfile ~/.docker/config.json $IMAGE_NAME:$IMAGE_TAG
fi

echo "✅ Image successfully pushed!"
echo ""
echo "📝 Build Summary:"
echo "   Image Name:    $IMAGE_NAME"
echo "   Image Tag:     $IMAGE_TAG"
echo "   Platform:      linux/amd64"

exit 0