#!/bin/bash
cd "$(dirname "$0")"
export ESLINT_NO_DEV_ERRORS=true
export NODE_OPTIONS='--max-old-space-size=4096'
npm run dev
