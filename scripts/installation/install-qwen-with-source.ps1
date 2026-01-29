#!/usr/bin/env pwsh
#
# Script to install Node.js and Qwen Code with source information
# This script handles the installation process and sets the installation source
#
# Usage: .\install-qwen-with-source.ps1 -Source github
#

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('github', 'npm', 'internal', 'local-build')]
    [string]$Source = "unknown"
)

$ErrorActionPreference = "Stop"

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Qwen Code Installation Script with Source Tracking" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "INFO: Installation source: $Source" -ForegroundColor Green

# Function to check if a command exists
function Test-CommandExists {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# Function to install Node.js
function Install-NodeJS {
    Write-Host "INFO: Checking for Node.js installation..." -ForegroundColor Yellow

    if (Test-CommandExists -Command "node") {
        $nodeVersion = node --version
        Write-Host "INFO: Node.js is already installed: $nodeVersion" -ForegroundColor Green

        # Check if version is sufficient (>= 20.0.0)
        try {
            $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
            if ($majorVersion -ge 20) {
                Write-Host "INFO: Node.js version is sufficient." -ForegroundColor Green
            } else {
                Write-Host "INFO: Node.js version is too low. Installing Node.js 20+..." -ForegroundColor Yellow
                Install-NodeJSViaNVM
            }
        } catch {
            Write-Host "INFO: Could not parse Node.js version. Installing Node.js 20+..." -ForegroundColor Yellow
            Install-NodeJSViaNVM
        }
    } else {
        Write-Host "INFO: Node.js not found. Installing Node.js 20+..." -ForegroundColor Yellow
        Install-NodeJSViaNVM
    }
}

# Function to install Node.js via nvm-windows
function Install-NodeJSViaNVM {
    Write-Host "INFO: Installing Node Version Manager (NVM) for Windows..." -ForegroundColor Yellow

    # Check if nvm is already installed
    if (Test-CommandExists -Command "nvm") {
        Write-Host "INFO: NVM is already installed." -ForegroundColor Green
    } else {
        Write-Host "INFO: Please install NVM for Windows manually from:" -ForegroundColor Yellow
        Write-Host "https://github.com/coreybutler/nvm-windows/releases" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "After installing NVM, run this script again." -ForegroundColor Yellow
        exit 1
    }

    # Install and use Node.js 20
    Write-Host "INFO: Installing Node.js 20..." -ForegroundColor Yellow
    nvm install 20
    nvm use 20
    
    $nodeVersion = node --version
    Write-Host "INFO: Node.js $nodeVersion installed and activated via NVM." -ForegroundColor Green
}

# Function to install Qwen Code with source information
function Install-QwenCode {
    Write-Host "INFO: Installing Qwen Code with source: $Source" -ForegroundColor Yellow

    # Install Qwen Code globally
    Write-Host "INFO: Running: npm install -g @qwen-code/qwen-code" -ForegroundColor Yellow
    npm install -g @qwen-code/qwen-code

    Write-Host "SUCCESS: Qwen Code installed successfully!" -ForegroundColor Green

    # After installation, create source.json in the .qwen directory
    Write-Host "INFO: Creating source.json in $env:USERPROFILE\.qwen..." -ForegroundColor Yellow
    
    $qwenDir = Join-Path $env:USERPROFILE ".qwen"
    if (-not (Test-Path -Path $qwenDir)) {
        New-Item -ItemType Directory -Path $qwenDir -Force | Out-Null
    }

    # Create the source.json file with the installation source
    $sourceJson = @{
        source = $Source
    } | ConvertTo-Json

    $sourceJsonPath = Join-Path $qwenDir "source.json"
    $sourceJson | Out-File -FilePath $sourceJsonPath -Encoding utf8 -Force
    
    Write-Host "SUCCESS: Installation source saved to $env:USERPROFILE\.qwen\source.json" -ForegroundColor Green

    # Verify installation
    if (Test-CommandExists -Command "qwen") {
        Write-Host "SUCCESS: Qwen Code is available as 'qwen' command." -ForegroundColor Green
        qwen --version
    } else {
        Write-Host "WARNING: Qwen Code may not be in PATH. Please check your npm global bin directory." -ForegroundColor Yellow
    }
}

# Main execution
function Main {
    Write-Host "INFO: Starting installation process..." -ForegroundColor Yellow
    Write-Host ""

    # Install Node.js
    Install-NodeJS

    # Install Qwen Code with source information
    Install-QwenCode

    Write-Host ""
    Write-Host "===========================================" -ForegroundColor Cyan
    Write-Host "SUCCESS: Installation completed!" -ForegroundColor Green
    Write-Host "The source information is stored in $env:USERPROFILE\.qwen\source.json" -ForegroundColor Green
    Write-Host ""
    Write-Host "To verify the installation:" -ForegroundColor Yellow
    Write-Host "  qwen --version" -ForegroundColor Cyan
    Write-Host "  Get-Content $env:USERPROFILE\.qwen\source.json" -ForegroundColor Cyan
    Write-Host "===========================================" -ForegroundColor Cyan
}

# Run main function
Main
