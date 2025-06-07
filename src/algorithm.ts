import * as fs from 'fs';
import { RandomForestRegression } from 'ml-random-forest';
import { Reimbursement, Trip } from './common/interfaces';
import { engineerFeatures } from './common/feature_engineering';

// --- Configuration & Model Loading ---
const L0_MODEL_DIR = './models/l0_specialists';
const L1_MODEL_PATH = './models/l1_meta_model.json';

const l0Models: { [key: string]: RandomForestRegression } = {};
const specialistModelFiles = fs.readdirSync(L0_MODEL_DIR);

for (const file of specialistModelFiles) {
    if (file.endsWith('.json')) {
        const modelName = file.replace('.json', '');
        const modelJson = JSON.parse(fs.readFileSync(`${L0_MODEL_DIR}/${file}`, 'utf-8'));
        l0Models[modelName] = RandomForestRegression.load(modelJson);
        console.log(`Loaded L0 model: ${modelName}`);
    }
}

const metaModel = RandomForestRegression.load(JSON.parse(fs.readFileSync(L1_MODEL_PATH, 'utf-8')));
console.log('Loaded L1 meta-model.');

// --- Prediction Logic ---
function calculateReimbursement(trip: Trip): Reimbursement {
    // Level 0: Get predictions from all specialist models
    const features = engineerFeatures(trip);
    const l0_predictions: number[] = [];

    // The order of predictions MUST match the order used during meta-model training.
    const specialistSegments = [
        'base', 'short_inefficient', 'short_efficient', 'mid_length', 'long_haul', 
        'long_conference', 'high_receipts', 'five_day_bonus'
    ];

    specialistSegments.forEach(name => {
        if (l0Models[name]) {
            const prediction = l0Models[name].predict([features])[0];
            l0_predictions.push(prediction);
        } else {
            // This case should ideally not happen if a model exists for every segment.
            // Push a neutral value if a model was not trained/found.
            l0_predictions.push(-1); 
        }
    });

    // Level 1: Meta-model predicts the final raw reimbursement
    const rawPrediction = metaModel.predict([l0_predictions])[0];

    // --- Final Adjustments ---
    let finalReimbursement = rawPrediction;
    
    // Sanity check: reimbursement should not be negative.
    finalReimbursement = Math.max(0, finalReimbursement);
    
    // Apply a cap based on a percentage of receipts, but only for high-receipt trips,
    // as identified by our `high_receipts` specialist segment logic.
    if (trip.receipts > 1200) {
        const receiptCap = trip.receipts * 0.9;
        finalReimbursement = Math.min(finalReimbursement, receiptCap);
    }

    // Round to two decimal places for currency.
    finalReimbursement = Math.round(finalReimbursement * 100) / 100;

    return { amount: finalReimbursement };
}

export { calculateReimbursement }; 