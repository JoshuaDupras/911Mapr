#!/bin/bash

image_repo=dupras/incident_map

# Function to increment version
increment_version() {
    local version=$1
    local part=$2

    major=$(echo $version | cut -d. -f1)
    minor=$(echo $version | cut -d. -f2)
    patch=$(echo $version | cut -d. -f3)

    case $part in
        "major")
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        "minor")
            minor=$((minor + 1))
            patch=0
            ;;
        "patch")
            patch=$((patch + 1))
            ;;
        *)
            echo "Invalid part to increment: $part"
            exit 1
            ;;
    esac

    echo "$major.$minor.$patch"
}

# Read current version from file
current_version=$(cat version.txt)

echo "Current version: $current_version"

# Prompt user for version bump type
read -p "Enter version bump type (major/minor/patch): " bump_type

# Increment version
new_version=$(increment_version $current_version $bump_type)

echo "New version: $new_version"

# Build Docker image
docker build -t $image_repo:$new_version .

# Tag Docker image
docker tag $image_repo:$new_version $image_repo:latest

# Push Docker image to Docker Hub
docker push $image_repo:$new_version
docker push $image_repo:latest

echo "Docker image pushed successfully"

# Write new version to file
echo $new_version > version.txt