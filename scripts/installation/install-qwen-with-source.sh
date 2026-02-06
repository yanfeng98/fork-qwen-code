#!/bin/bash

# Script to install Node.js and Qwen Code with source information
# This script handles the installation process and sets the installation source
#
# Usage: install-qwen-with-source.sh --source [github|npm|internal|local-build]
#        install-qwen-with-source.sh -s [github|npm|internal|local-build]

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -s, --source SOURCE    Specify the installation source (e.g., github, npm, internal)"
    echo "  -h, --help             Show this help message"
    echo ""
    exit 1
}

# Parse command line arguments
SOURCE="unknown"
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--source)
            SOURCE="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            usage
            ;;
    esac
done

echo "==========================================="
echo "Qwen Code Installation Script with Source Tracking"
echo "==========================================="

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check and install Node.js
install_nodejs() {
    if command_exists node; then
        NODE_VERSION=$(node --version)
        # Extract major version number (remove 'v' prefix and get first number)
        NODE_MAJOR_VERSION=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d'.' -f1)
        
        if [ "$NODE_MAJOR_VERSION" -ge 20 ]; then
            echo "✓ Node.js is already installed: $NODE_VERSION"
            return 0
        else
            echo "⚠ Node.js $NODE_VERSION is installed, but Qwen Code requires Node.js 20+"
            echo "Installing Node.js 20+..."
            install_nodejs_via_nvm
        fi
    else
        echo "Installing Node.js 20+..."
        install_nodejs_via_nvm
    fi
}

# Function to install Node.js via nvm
install_nodejs_via_nvm() {
    # Install NVM if not already installed
    if [ ! -d "$HOME/.nvm" ]; then
        echo "Downloading NVM..."
        
        # Download NVM install script to a temporary file first
        TMP_INSTALL_SCRIPT="/tmp/nvm_install_$.sh"
        
        if curl -f -s -S -o "$TMP_INSTALL_SCRIPT" "https://qwen-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install_nvm.sh"; then
            # Run the installation script
            if bash "$TMP_INSTALL_SCRIPT"; then
                rm -f "$TMP_INSTALL_SCRIPT"
            else
                echo "✗ NVM installation failed"
                rm -f "$TMP_INSTALL_SCRIPT"
                echo "Please install Node.js manually from: https://nodejs.org/"
                exit 1
            fi
        else
            echo "✗ Failed to download NVM"
            rm -f "$TMP_INSTALL_SCRIPT"
            echo "Please check your internet connection or install Node.js manually from https://nodejs.org/"
            exit 1
        fi
    fi

    # Load NVM
    export NVM_DIR="$HOME/.nvm"
    
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        \. "$NVM_DIR/nvm.sh"
    else
        echo "✗ NVM installation failed"
        echo "Please install Node.js manually from https://nodejs.org/"
        exit 1
    fi

    # Load bash completion if available
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

    # Verify NVM is loaded
    if ! command_exists nvm; then
        echo "✗ Failed to load NVM"
        echo "Please manually load NVM or install Node.js from https://nodejs.org/"
        exit 1
    fi

    # Install and use Node.js 20+
    echo "Installing Node.js 20..."
    if nvm install 20 >/dev/null 2>&1; then
        nvm use 20 >/dev/null 2>&1
    else
        echo "✗ Failed to install Node.js 20"
        exit 1
    fi
    
    # Verify Node.js installation
    if command_exists node; then
        NODE_VERSION=$(node --version)
        echo "✓ Node.js $NODE_VERSION installed"
    else
        echo "✗ Node.js installation verification failed"
        exit 1
    fi
}

# Function to check and install Qwen Code
install_qwen_code() {
    if command_exists qwen; then
        QWEN_VERSION=$(qwen --version 2>/dev/null || echo "unknown")
        echo "✓ Qwen Code is already installed: $QWEN_VERSION"
        
        # Update source.json only if source parameter was provided
        if [ "$SOURCE" != "unknown" ]; then
            echo "Updating source.json in ~/.qwen/"
            create_source_json
        fi
        return 0
    fi


    # Check if running as root
    if [ "$(id -u)" -eq 0 ]; then
        # Running as root, no need for sudo
        NPM_INSTALL_CMD="npm install -g @qwen-code/qwen-code"
    else
        # Not root, use sudo
        NPM_INSTALL_CMD="sudo npm install -g @qwen-code/qwen-code"
    fi

    # Install Qwen Code globally
    if $NPM_INSTALL_CMD >/dev/null 2>&1; then
        echo "✓ Qwen Code installed successfully!"
        
        # Create source.json only if source parameter was provided
        if [ "$SOURCE" != "unknown" ]; then
            create_source_json
        fi
        
        # Verify installation
        if command_exists qwen; then
            QWEN_VERSION=$(qwen --version 2>/dev/null || echo "unknown")
            echo "✓ Qwen Code is available as 'qwen' command"
            echo "  Installed version: $QWEN_VERSION"
        else
            echo "⚠ Qwen Code installed but not in PATH"
            echo "  You may need to restart your terminal"
        fi
    else
        echo "✗ Failed to install Qwen Code"
        exit 1
    fi
}

# Function to create source.json
create_source_json() {
    QWEN_DIR="$HOME/.qwen"
    
    # Create .qwen directory if it doesn't exist
    if [ ! -d "$QWEN_DIR" ]; then
        mkdir -p "$QWEN_DIR"
    fi
    
    # Create source.json file
    cat > "$QWEN_DIR/source.json" <<EOF
{
  "source": "$SOURCE"
}
EOF
    
    echo "✓ Installation source saved to ~/.qwen/source.json"
}

# Main execution
main() {
    # Step 1: Check and install Node.js
    install_nodejs
    echo ""

    # Step 2: Check and install Qwen Code
    install_qwen_code
    echo ""

    echo "==========================================="
    echo "✓ Installation completed!"
    echo "==========================================="
    echo ""
    
    # Try to source the shell configuration file
    if [ -f "$HOME/.zshrc" ]; then
        echo "Loading zsh configuration..."
        source "$HOME/.zshrc" 2>/dev/null || true
    elif [ -f "$HOME/.bashrc" ]; then
        echo "Loading bash configuration..."
        source "$HOME/.bashrc" 2>/dev/null || true
    fi
    
    echo "To use Qwen Code in new terminals, run: qwen"
    echo "If 'qwen' command is not found, please restart your terminal."
}

# Run main function
main