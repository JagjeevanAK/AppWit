#!/bin/bash

# Start PostgreSQL
service postgresql start

# Wait for PostgreSQL to be ready
sleep 2

# Run Next.js dev server with Bun
bun run dev
