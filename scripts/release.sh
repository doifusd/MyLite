#!/bin/bash

# MyLite Release Script
# Automates the entire release process: commit, push, and tag

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to display usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

OPTIONS:
    -v, --version VERSION    Release version (e.g., 1.2.0)
    -m, --message MESSAGE    Commit message (optional, auto-generated if not provided)
    -p, --patch              Bump patch version (e.g., 1.2.0 -> 1.2.1)
    -n, --minor              Bump minor version (e.g., 1.2.0 -> 1.3.0)
    -M, --major              Bump major version (e.g., 1.2.0 -> 2.0.0)
    -h, --help               Show this help message

EXAMPLES:
    # Release with specific version
    $0 -v 1.3.0

    # Release with custom message
    $0 -v 1.3.0 -m "feat: add new features"

    # Auto-bump patch version
    $0 --patch

    # Auto-bump minor version
    $0 --minor

    # Auto-bump major version
    $0 --major
EOF
    exit 1
}

# Get current version from package.json
get_current_version() {
    grep '"version"' package.json | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/'
}

# Bump version based on strategy
bump_version() {
    local current=$1
    local strategy=$2
    local IFS='.'
    local parts=($current)

    case $strategy in
        patch)
            parts[2]=$((parts[2] + 1))
            ;;
        minor)
            parts[1]=$((parts[1] + 1))
            parts[2]=0
            ;;
        major)
            parts[0]=$((parts[0] + 1))
            parts[1]=0
            parts[2]=0
            ;;
    esac

    echo "${parts[0]}.${parts[1]}.${parts[2]}"
}

# Parse arguments
VERSION=""
COMMIT_MESSAGE=""
BUMP_STRATEGY=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -m|--message)
            COMMIT_MESSAGE="$2"
            shift 2
            ;;
        -p|--patch)
            BUMP_STRATEGY="patch"
            shift
            ;;
        -n|--minor)
            BUMP_STRATEGY="minor"
            shift
            ;;
        -M|--major)
            BUMP_STRATEGY="major"
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            ;;
    esac
done

# If no version provided but bump strategy is, calculate version
if [ -z "$VERSION" ] && [ -n "$BUMP_STRATEGY" ]; then
    CURRENT_VERSION=$(get_current_version)
    print_info "Current version: $CURRENT_VERSION"
    VERSION=$(bump_version "$CURRENT_VERSION" "$BUMP_STRATEGY")
    print_info "New version: $VERSION"
fi

# Validate version format
if [ -z "$VERSION" ]; then
    print_error "Version must be provided with -v/--version or auto-bump with -p/-n/-M"
    usage
fi

if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_error "Invalid version format: $VERSION (expected: X.Y.Z)"
    exit 1
fi

print_info "Starting release process for version $VERSION"

# Check git status
if [ -n "$(git status --porcelain)" ]; then
    print_warning "Uncommitted changes detected"
    git status --short
    read -p "Continue with release? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Release cancelled"
        exit 1
    fi
fi

# Update version in package.json
print_info "Updating version in package.json..."
sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json
rm package.json.bak
print_success "Updated package.json"

# Update version in Cargo.toml
print_info "Updating version in src-tauri/Cargo.toml..."
sed -i.bak "s/^version = \"[^\"]*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml
rm src-tauri/Cargo.toml.bak
print_success "Updated src-tauri/Cargo.toml"

# Stage version changes
git add package.json src-tauri/Cargo.toml

# Generate commit message if not provided
if [ -z "$COMMIT_MESSAGE" ]; then
    COMMIT_MESSAGE="chore: bump version to $VERSION"
fi

# Commit changes
print_info "Creating commit..."
git commit -m "$COMMIT_MESSAGE"
print_success "Commit created: $(git rev-parse --short HEAD)"

# Push to remote
print_info "Pushing to remote..."
git push origin main
print_success "Pushed to origin/main"

# Create annotated tag
TAG_NAME="v$VERSION"
TAG_MESSAGE="Release version $VERSION

This release includes all features documented in RELEASE_NOTES.md"

print_info "Creating tag: $TAG_NAME..."
git tag -a "$TAG_NAME" -m "$TAG_MESSAGE"
print_success "Tag created: $TAG_NAME"

# Push tag
print_info "Pushing tag to remote..."
git push origin "$TAG_NAME"
print_success "Tag pushed to remote"

# Final summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🎉 Release Complete!                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "Version: ${BLUE}$VERSION${NC}"
echo -e "Tag: ${BLUE}$TAG_NAME${NC}"
echo -e "Commit: ${BLUE}$(git rev-parse --short HEAD)${NC}"
echo ""
echo "📌 GitHub Release will be automatically created by Actions workflow"
echo "📚 Release Notes: https://github.com/doifusd/MyLite/blob/main/RELEASE_NOTES.md"
echo "🔗 View on GitHub: https://github.com/doifusd/MyLite/releases/tag/$TAG_NAME"
echo ""
print_success "Release $VERSION is ready!"
