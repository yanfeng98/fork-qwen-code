# Installation Guide for Qwen Code with Source Tracking

This guide describes how to install Node.js and Qwen Code with source information tracking.

## Script: install-qwen-with-source.sh

The script automates the installation of Node.js (if not present or below version 20) and Qwen Code, while capturing and storing the installation source information.

### Features:

- Checks for existing Node.js installation and version
- Installs Node.js 20+ if needed using NVM
- Installs Qwen Code globally with source information
- Stores the source information in the ~/.qwen/source.json file

### Usage:

```bash
# Install with a specific source
./install-qwen-with-source.sh --source github

# Install with internal source
./install-qwen-with-source.sh -s internal

# Show help
./install-qwen-with-source.sh --help
```

### How it Works:

1. The script accepts a `--source` parameter to specify where Qwen Code is being installed from
2. It installs Node.js if needed
3. It installs Qwen Code globally
4. It creates `~/.qwen/source.json` with the specified source information
5. The postinstall script validates and ensures proper formatting of the source.json file
6. The source information is stored separately in `~/.qwen/source.json`

### Prerequisites:

- curl (for NVM installation and script download)
- bash-compatible shell

### Notes:

- The script requires internet access to download Node.js and Qwen Code
- Administrative privileges may be required for global npm installation
- The installation source is stored locally and used for tracking purposes

### Remote Execution:

You can also run the script directly from a remote location using curl:

```bash
# Download and execute the script with a source parameter
curl -fsSL https://your-domain.com/install-qwen-with-source.sh | bash -s -- --source github

# Or download the script first, then execute
curl -fsSL https://your-domain.com/install-qwen-with-source.sh -o install-qwen.sh
chmod +x install-qwen.sh
./install-qwen.sh --source github
```

Note: Replace `https://your-domain.com/install-qwen-with-source.sh` with the actual URL where the script is hosted.

## Installation Source Feature

### Overview

This feature implements the ability to capture and store the installation source of the Qwen Code package.

### How to Use

To specify the installation source during npm install, you can use:

#### Method 1: Using the Installation Script

Use the provided installation script that handles Node.js installation and creates a source file:

```bash
./install-qwen-with-source.sh --source github
```

The script will:

1. Install Node.js if needed
2. Install Qwen Code globally
3. Create `~/.qwen/source.json` with the specified source information
4. The postinstall script validates the source.json file

#### Default behavior

If no source is specified, no source.json file will be created.

### Storage Location

The installation source is stored in a separate file at:

- Unix/Linux/macOS: `~/.qwen/source.json`
- Windows: `%USERPROFILE%\.qwen\source.json`

The file contains:

```json
{
  "source": "github"
}
```

### Technical Details

- The source information is stored as a separate JSON file
- The feature integrates with the existing postinstall script for validation
- The implementation does not modify the core settings system
