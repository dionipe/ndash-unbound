#!/bin/bash

# NDash Quick Start Script

echo "🚀 Starting NDash - Bind DNS Management Dashboard..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Start the application
echo "✅ Starting server on http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm start
