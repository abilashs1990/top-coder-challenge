import * as fs from 'fs';
import { RandomForestRegression } from 'ml-random-forest';
import { Trip, Case } from '../src/common/interfaces';
import { engineerFeatures } from '../src/common/feature_engineering';

// This is a direct copy of the core logic from algorithm.ts.
// In a real application, this would be imported, but for a one-off analysis script,
// this duplication is acceptable to avoid pathing issues and keep it self-contained.

// --- Model Loading ---
const models: { [key: string]: RandomForestRegression } = {};
if (fs.existsSync('./models')) {
    const modelFiles = fs.readdirSync('./models');
    modelFiles.forEach(file => {
        if (file.endsWith('_model.json')) {
            const name = file.replace('_model.json', '');
            const modelJson = fs.readFileSync(`./models/${file}`, 'utf-8');
            models[name] = RandomForestRegression.load(JSON.parse(modelJson));
        }
    });
}

// --- Rule-Based Adjustments & Penalties ---
function applyRuleBasedAdjustments(trip: Trip, prediction: number): number {
    let adjustedAmount = prediction;
    const reasonableMax = (trip.receipts * 0.8) + (trip.miles * 0.5) + (trip.days * 100);
    if (adjustedAmount > reasonableMax * 1.2) {
        adjustedAmount = reasonableMax;
    }
    const cents = trip.receipts - Math.floor(trip.receipts);
    if (Math.abs(cents - 0.49) < 0.001 || Math.abs(cents - 0.99) < 0.001) {
        adjustedAmount += 10;
    }
    const efficiency = trip.days > 0 ? trip.miles / trip.days : 0;
    if (trip.days > 3 && efficiency < 25) {
        adjustedAmount -= 200;
    }
    if (trip.days > 1 && trip.receipts > 0 && trip.receipts < 60) {
        adjustedAmount -= 100;
    }
    return Math.round(adjustedAmount);
}

const milesPerDay = (t: Trip) => t.days > 0 ? t.miles / t.days : 0;

// --- Main Calculation Logic ---
function getPredictionDetails(trip: Trip): { finalPrediction: number, rawPrediction: number, specialistModels: string[] } {
  const features = engineerFeatures(trip);
  const predictions: { name: string, value: number }[] = [];
  const specialistModels: string[] = [];

  if (trip.days <= 2 && milesPerDay(trip) < 50) { specialistModels.push('short_inefficient'); }
  if (trip.days <= 2 && milesPerDay(trip) >= 100) { specialistModels.push('short_efficient'); }
  if (trip.days > 2 && trip.days <= 6) { specialistModels.push('mid_length'); }
  if (trip.days >= 7 && milesPerDay(trip) >= 100) { specialistModels.push('long_haul'); }
  if (trip.days >= 7 && milesPerDay(trip) < 50) { specialistModels.push('long_conference'); }
  if (trip.receipts > 1200) { specialistModels.push('high_receipts'); }
  if (trip.days === 5) { specialistModels.push('five_day_bonus'); }

  specialistModels.forEach(modelName => {
      if (models[modelName]) {
        predictions.push({ name: modelName, value: models[modelName].predict([features])[0] });
      }
  })

  let rawPrediction: number;
  const basePrediction = models.base.predict([features])[0];

  if (predictions.length === 0) {
    rawPrediction = basePrediction;
  } else {
    const specialistAverage = predictions.reduce((acc, p) => acc + p.value, 0) / predictions.length;
    rawPrediction = 0.4 * basePrediction + 0.6 * specialistAverage;
  }
  
  const finalPrediction = applyRuleBasedAdjustments(trip, rawPrediction);
  return { finalPrediction, rawPrediction, specialistModels };
}

// --- Error Analysis Execution ---
const cases: Case[] = JSON.parse(fs.readFileSync('./public_cases.json', 'utf-8'));
const errors: any[] = [];

cases.forEach((c, i) => {
    const trip: Trip = {
        days: c.input.trip_duration_days,
        miles: c.input.miles_traveled,
        receipts: c.input.total_receipts_amount
    };
    const { finalPrediction, rawPrediction, specialistModels } = getPredictionDetails(trip);
    const error = Math.abs(finalPrediction - c.expected_output);
    errors.push({
        caseIndex: i,
        trip,
        rawPrediction,
        finalPrediction,
        expected: c.expected_output,
        error,
        specialistModels
    });
});

// Sort by error descending and get top 30
errors.sort((a, b) => b.error - a.error);
const top30Errors = errors.slice(0, 30);

console.log("--- Top 30 Error Cases ---");
top30Errors.forEach(e => {
    console.log(`
--------------------------------------------------
Case #${e.caseIndex}
  - Input:          Days=${e.trip.days}, Miles=${e.trip.miles}, Receipts=$${e.trip.receipts}
  - Models Used:    [${e.specialistModels.join(', ')}]
  - Raw Prediction: $${e.rawPrediction.toFixed(2)}
  - Final Prediction: $${e.finalPrediction.toFixed(2)}
  - Expected:         $${e.expected.toFixed(2)}
  - Error:            $${e.error.toFixed(2)}
--------------------------------------------------`);
}); 