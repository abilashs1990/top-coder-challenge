"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const algorithm_1 = require("./algorithm");
// This script can be called in two ways:
// 1. With command line arguments: node dist/cli.js <days> <miles> <receipts>
//    This is used by the `eval.sh` script.
// 2. By piping JSON to stdin: cat some_file.json | node dist/cli.js
//    This is useful for local testing.
if (process.argv.length === 5) {
    // Case 1: Called with command line arguments
    const trip = {
        days: parseFloat(process.argv[2]),
        miles: parseFloat(process.argv[3]),
        receipts: parseFloat(process.argv[4]),
    };
    const reimbursement = (0, algorithm_1.calculateReimbursement)(trip);
    // The eval script expects a single number as output
    console.log(reimbursement);
}
else {
    // Case 2: Read from stdin
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });
    rl.on('line', (line) => {
        try {
            const input = JSON.parse(line);
            const trip = {
                days: input.days,
                miles: input.miles,
                receipts: input.receipts,
            };
            const reimbursement = (0, algorithm_1.calculateReimbursement)(trip);
            // For piped input, we'll output JSON
            console.log(JSON.stringify({ reimbursement }));
        }
        catch (e) {
            // Per instructions, ignore lines that are not valid JSON.
        }
    });
}
