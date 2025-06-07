import * as fs from 'fs';
import { RandomForestRegression } from 'ml-random-forest';
import { Case, TrainingData, Trip } from '../common/interfaces';
import { engineerFeatures } from '../common/feature_engineering';

// --- Configuration ---
const L0_MODEL_DIR = './models/l0_specialists';
const L1_MODEL_PATH = './models/l1_meta_model.json';
const TRAIN_TEST_SPLIT_RATIO = 0.8;

// Ensure directories exist
if (!fs.existsSync(L0_MODEL_DIR)) {
    fs.mkdirSync(L0_MODEL_DIR, { recursive: true });
}

// --- Data Loading and Preparation ---
const allCases: Case[] = JSON.parse(fs.readFileSync('./public_cases.json', 'utf-8'));
const trainSize = Math.floor(allCases.length * TRAIN_TEST_SPLIT_RATIO);
const trainCases = allCases.slice(0, trainSize);
const validationCases = allCases.slice(trainSize);

const modelOptions: { [key: string]: any } = {
    'high_receipts': { nEstimators: 250, maxFeatures: 0.6, seed: 42 },
    'default': { nEstimators: 100, maxFeatures: 0.8, seed: 42 }
};

// --- Level 0: Train Specialist Models ---
console.log('--- Training Level 0 Specialist Models ---');
const milesPerDay = (t: Trip) => t.days > 0 ? t.miles / t.days : 0;
const specialistSegments = [
    { name: 'base', filter: () => true },
    { name: 'short_inefficient', filter: (t: Trip) => t.days <= 2 && milesPerDay(t) < 50 },
    { name: 'short_efficient', filter: (t: Trip) => t.days <= 2 && milesPerDay(t) >= 100 },
    { name: 'mid_length', filter: (t: Trip) => t.days > 2 && t.days <= 6 },
    { name: 'long_haul', filter: (t: Trip) => t.days >= 7 && milesPerDay(t) >= 100 },
    { name: 'long_conference', filter: (t: Trip) => t.days >= 7 && milesPerDay(t) < 50 },
    { name: 'high_receipts', filter: (t: Trip) => t.receipts > 1200 },
    { name: 'five_day_bonus', filter: (t: Trip) => t.days === 5 }
];

const l0Models: { [key: string]: RandomForestRegression } = {};
specialistSegments.forEach(segment => {
    const features: number[][] = [];
    const labels: number[] = [];
    trainCases.forEach(c => {
        const trip: Trip = { days: c.input.trip_duration_days, miles: c.input.miles_traveled, receipts: c.input.total_receipts_amount };
        if (segment.filter(trip)) {
            features.push(engineerFeatures(trip));
            labels.push(c.expected_output);
        }
    });

    if (features.length < 10) {
        console.warn(`Skipping L0 training for ${segment.name}: not enough data.`);
        return;
    }
    
    console.log(`Training L0 model: ${segment.name} with ${features.length} samples.`);
    const options = modelOptions[segment.name] || modelOptions['default'];
    const model = new RandomForestRegression(options);
    model.train(features, labels);
    
    fs.writeFileSync(`${L0_MODEL_DIR}/${segment.name}.json`, JSON.stringify(model.toJSON()));
    l0Models[segment.name] = model;
});

// --- Level 1: Train Meta-Model ---
console.log('\n--- Generating Features for Level 1 Meta-Model ---');
const metaFeatures: number[][] = [];
const metaLabels: number[] = [];

validationCases.forEach(c => {
    const trip: Trip = { days: c.input.trip_duration_days, miles: c.input.miles_traveled, receipts: c.input.total_receipts_amount };
    const l0_predictions: number[] = [];

    // Get predictions from all L0 models to use as features
    specialistSegments.forEach(segment => {
        if (l0Models[segment.name]) {
            const prediction = l0Models[segment.name].predict([engineerFeatures(trip)])[0];
            l0_predictions.push(prediction);
        } else {
            l0_predictions.push(-1); // Use a placeholder if model was skipped
        }
    });
    
    metaFeatures.push(l0_predictions);
    metaLabels.push(c.expected_output);
});

console.log(`\n--- Training Level 1 Meta-Model with ${metaFeatures.length} samples ---`);
const metaModel = new RandomForestRegression({ nEstimators: 150, seed: 42 });
metaModel.train(metaFeatures, metaLabels);
fs.writeFileSync(L1_MODEL_PATH, JSON.stringify(metaModel.toJSON()));

console.log('\n--- Stacked Ensemble Training Complete ---'); 