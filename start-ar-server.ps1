# Quick start script for testing AR view
# Checks for available server options and provides instructions

Write-Host "`n=== AR View Testing - Quick Start ===" -ForegroundColor Cyan
Write-Host ""

# Get local IP
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -like "192.168.*"}).IPAddress | Select-Object -First 1

if ($localIP) {
    Write-Host "Your PC's IP address: $localIP" -ForegroundColor Green
} else {
    Write-Host "Could not detect local IP address" -ForegroundColor Yellow
    $localIP = "YOUR-PC-IP"
}

Write-Host ""
Write-Host "Choose a server option:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Python HTTP Server (Quick - Manual Mode Only)" -ForegroundColor Yellow
Write-Host "   - Camera WON'T work on iPhone" 
Write-Host "   - Use Manual Location for testing"
Write-Host ""
Write-Host "2. Node.js HTTPS Server (Recommended - Full AR)" -ForegroundColor Green
Write-Host "   - Camera WILL work on iPhone"
Write-Host "   - Requires certificates (one-time setup)"
Write-Host ""
Write-Host "3. Instructions Only" -ForegroundColor Gray
Write-Host ""

$choice = Read-Host "Select option (1-3)"

switch ($choice) {
    "1" {
        Write-Host "`nStarting Python HTTP server..." -ForegroundColor Yellow
        Write-Host "Camera will NOT work - use Manual Mode" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "On your iPhone:" -ForegroundColor Cyan
        Write-Host "  1. Connect to same WiFi"
        Write-Host "  2. Open Safari: http://$localIP:8000/pages/ar-view.html"
        Write-Host "  3. Enable 'Manual Location' checkbox"
        Write-Host "  4. Set coordinates: Lat: 52.92640, Lon: -1.49800"
        Write-Host ""
        Write-Host "Press Ctrl+C to stop server" -ForegroundColor Gray
        Write-Host ""
        python -m http.server 8000 --bind 0.0.0.0
    }
    
    "2" {
        # Check if Node.js is installed
        $nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
        
        if (-not $nodeInstalled) {
            Write-Host "`nNode.js not found!" -ForegroundColor Red
            Write-Host "Download from: https://nodejs.org/" -ForegroundColor Yellow
            Write-Host ""
            pause
            exit
        }
        
        # Check if certificates exist
        if (-not (Test-Path ".\certs\cert.pem") -or -not (Test-Path ".\certs\key.pem")) {
            Write-Host "`nCertificates not found. Generating..." -ForegroundColor Yellow
            
            # Check if OpenSSL is available
            $opensslInstalled = Get-Command openssl -ErrorAction SilentlyContinue
            
            if (-not $opensslInstalled) {
                Write-Host "`nOpenSSL not found!" -ForegroundColor Red
                Write-Host "Options:" -ForegroundColor Yellow
                Write-Host "  1. Install Git for Windows (includes OpenSSL)"
                Write-Host "  2. Download from: https://slproweb.com/products/Win32OpenSSL.html"
                Write-Host ""
                Write-Host "After installing, run this script again."
                Write-Host ""
                pause
                exit
            }
            
            # Create certs directory
            New-Item -ItemType Directory -Force -Path ".\certs" | Out-Null
            
            Write-Host "Generating self-signed certificate..." -ForegroundColor Cyan
            Write-Host "(Press Enter for all prompts, or fill as needed)" -ForegroundColor Gray
            Write-Host ""
            
            & openssl req -newkey rsa:2048 -new -nodes -x509 -days 365 -keyout .\certs\key.pem -out .\certs\cert.pem
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "`nCertificates created successfully!" -ForegroundColor Green
            } else {
                Write-Host "`nFailed to create certificates" -ForegroundColor Red
                pause
                exit
            }
        }
        
        Write-Host "`nStarting HTTPS server..." -ForegroundColor Green
        Write-Host ""
        Write-Host "On your iPhone:" -ForegroundColor Cyan
        Write-Host "  1. Connect to same WiFi"
        Write-Host "  2. Open Safari: https://$localIP:8000/pages/ar-view.html"
        Write-Host "  3. Accept certificate warning (Show Details -> visit website)"
        Write-Host "  4. Grant camera and location permissions"
        Write-Host "  5. Wave device in figure-8 to calibrate compass"
        Write-Host ""
        Write-Host "Camera and GPS will work! 📷" -ForegroundColor Green
        Write-Host ""
        Write-Host "Press Ctrl+C to stop server" -ForegroundColor Gray
        Write-Host ""
        node https-server.js
    }
    
    "3" {
        Write-Host "`n=== Manual Setup Instructions ===" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Your PC IP: $localIP" -ForegroundColor Green
        Write-Host ""
        Write-Host "HTTP Server (Camera won't work):" -ForegroundColor Yellow
        Write-Host "  python -m http.server 8000 --bind 0.0.0.0"
        Write-Host "  iPhone: http://$localIP:8000/pages/ar-view.html"
        Write-Host ""
        Write-Host "HTTPS Server (Camera will work):" -ForegroundColor Green
        Write-Host "  1. Generate certificates (one-time):"
        Write-Host "     mkdir certs"
        Write-Host "     cd certs"
        Write-Host "     openssl req -newkey rsa:2048 -new -nodes -x509 -days 365 -keyout key.pem -out cert.pem"
        Write-Host "     cd .."
        Write-Host ""
        Write-Host "  2. Start server:"
        Write-Host "     node https-server.js"
        Write-Host ""
        Write-Host "  3. iPhone: https://$localIP:8000/pages/ar-view.html"
        Write-Host ""
        Write-Host "See SAFARI_TESTING_GUIDE.md for more details" -ForegroundColor Gray
        Write-Host ""
        pause
    }
    
    default {
        Write-Host "`nInvalid option" -ForegroundColor Red
        pause
    }
}
