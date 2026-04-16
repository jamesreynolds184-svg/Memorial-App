// Simple HTTPS server for testing AR view on iPhone
// Usage: node https-server.js
// Then access from iPhone: https://YOUR-PC-IP:8000

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8000;
const USE_HTTPS = true; // Set to false to use HTTP only

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.geojson': 'application/geo+json'
};

const requestHandler = (req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  let filePath = '.' + url.parse(req.url).pathname;
  if (filePath === './') {
    filePath = './home.html';
  }
  
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';
  
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + error.code, 'utf-8');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
};

// Get local IP address
const getLocalIP = () => {
  const nets = require('os').networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
};

if (USE_HTTPS) {
  // Check if certificates exist
  const certPath = './certs/cert.pem';
  const keyPath = './certs/key.pem';
  
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.error('\n❌ HTTPS certificates not found!');
    console.error('\nTo generate certificates, run:');
    console.error('  mkdir certs');
    console.error('  cd certs');
    console.error('  openssl req -newkey rsa:2048 -new -nodes -x509 -days 365 -keyout key.pem -out cert.pem');
    console.error('\nOr set USE_HTTPS = false in this file to use HTTP (camera won\'t work on iPhone)\n');
    process.exit(1);
  }
  
  const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
  
  const server = https.createServer(options, requestHandler);
  
  server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log('\n✅ HTTPS Server running!\n');
    console.log(`   Local:   https://localhost:${PORT}`);
    console.log(`   Network: https://${localIP}:${PORT}`);
    console.log('\n📱 On your iPhone:');
    console.log(`   1. Connect to same WiFi as this PC`);
    console.log(`   2. Open Safari and go to: https://${localIP}:${PORT}`);
    console.log(`   3. Accept the certificate warning`);
    console.log(`   4. Navigate to pages/ar-view.html`);
    console.log('\n   Camera and location will work! 📷\n');
  });
} else {
  const server = http.createServer(requestHandler);
  
  server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log('\n⚠️  HTTP Server running (camera will NOT work on iPhone)\n');
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Network: http://${localIP}:${PORT}`);
    console.log('\n📱 On your iPhone - use Manual Mode for testing:');
    console.log(`   1. Open Safari: http://${localIP}:${PORT}/pages/ar-view.html`);
    console.log(`   2. Enable "Manual Location" checkbox`);
    console.log(`   3. Enter coordinates and test heading rotation`);
    console.log('\n   For camera access, set USE_HTTPS = true and generate certificates\n');
  });
}
