#!/bin/bash

# Script to install Node.js and Qwen Code
# This script checks and installs Node.js and Qwen Code if not already installed

echo "==========================================="
echo "Qwen Code Installation Script"
echo "==========================================="

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check and install Node.js
install_nodejs() {
    if command_exists node; then
        NODE_VERSION=$(node --version)
        echo "✓ Node.js is already installed: $NODE_VERSION"
        return 0
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
        
        if curl -f -s -S -o "$TMP_INSTALL_SCRIPT" https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh; then
            # Run the installation script
            if bash "$TMP_INSTALL_SCRIPT"; then
                rm -f "$TMP_INSTALL_SCRIPT"
            else
                echo "✗ NVM installation failed"
                rm -f "$TMP_INSTALL_SCRIPT"
                echo "Please install Node.js manually from https://nodejs.org/"
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
        return 0
    fi

    echo "Installing Qwen Code..."

    # Install Qwen Code globally (may require sudo)
    if sudo npm install -g @qwen-code/qwen-code >/dev/null 2>&1; then
        # Verify installation
        if command_exists qwen; then
            QWEN_VERSION=$(qwen --version 2>/dev/null || echo "unknown")
            echo "✓ Qwen Code $QWEN_VERSION installed"
        else
            echo "⚠ Qwen Code installed but not in PATH"
            echo "  You may need to restart your terminal"
        fi
    else
        echo "✗ Failed to install Qwen Code"
        exit 1
    fi
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
    echo "Run 'qwen' to start using Qwen Code"
}

# Run main function
main