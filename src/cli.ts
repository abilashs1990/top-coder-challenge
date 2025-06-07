import { calculateReimbursement } from './algorithm';
import fs from 'fs';

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
  const reimbursement = calculateReimbursement(trip);
  // The eval script expects a single number as output
  console.log(reimbursement);
} else {
  // Case 2: Read from stdin
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });

    rl.on('line', (line: string) => {
        try {
            const input = JSON.parse(line);
            const trip = {
                days: input.trip_duration_days,
                miles: input.miles_traveled,
                receipts: input.total_receipts_amount,
            };
            const reimbursement = calculateReimbursement(trip);
            // For piped input, we'll output JSON
            console.log(JSON.stringify({ reimbursement_amount: reimbursement.amount }));
        } catch (e) {
            // Per instructions, ignore lines that are not valid JSON.
        }
    });
} 