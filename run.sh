#!/bin/bash

# Check if node is available
if ! command -v node &> /dev/null
then
    echo "Error: node could not be found. Please install Node.js."
    exit 1
fi

# The directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# The path to the compiled cli.js file
CLI_PATH="$SCRIPT_DIR/dist/cli.js"

# Check if the cli.js file exists
if [ ! -f "$CLI_PATH" ]; then
    echo "Error: cli.js not found. Please run 'npm run build' first."
    exit 1
fi

# Execute the Node.js script
exec node "$CLI_PATH" "$@" 