#!/bin/bash

# Create log directory
mkdir -p /home/user/.logs

# Initialize log file
echo "[$(date)] Starting dev server..." > /home/user/.logs/dev-server.log

# Start PostgreSQL
service postgresql start

# Wait for PostgreSQL to be ready
sleep 2

# Run Next.js dev server with Bun
# Use unbuffer (from expect package) or stdbuf to prevent buffering
# Pipe through tee to capture logs while keeping stdout visible
exec bun run dev 2>&1 | tee -a /home/user/.logs/dev-server.log
