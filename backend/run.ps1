# PowerShell script to start the backend server
Write-Host "Starting Taskerrand Backend Server..." -ForegroundColor Green
Write-Host ""

# Navigate to backend directory
Set-Location $PSScriptRoot

# Activate virtual environment
& ".\venv\Scripts\Activate.ps1"

# Run the server
python main.py

