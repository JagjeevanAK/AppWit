#!/bin/bash

# Start PostgreSQL
sudo service postgresql start

# Wait for PostgreSQL to be ready
sleep 2

# Run Next.js dev server
npm run dev
