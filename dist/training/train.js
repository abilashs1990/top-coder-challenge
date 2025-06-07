"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const ml_random_forest_1 = require("ml-random-forest");
const feature_engineering_1 = require("../common/feature_engineering");
// Ensure the models directory exists
if (!fs.existsSync('./models')) {
    fs.mkdirSync('./models');
}
const cases = JSON.parse(fs.readFileSync('./public_cases.json', 'utf-8'));
function prepareData(filter) {
    const features = [];
    const labels = [];
    cases.forEach(c => {
        const trip = {
            days: c.input.trip_duration_days,
            miles: c.input.miles_traveled,
            receipts: c.input.total_receipts_amount
        };
        if (filter(trip)) {
            features.push((0, feature_engineering_1.engineerFeatures)(trip));
            labels.push(c.expected_output);
        }
    });
    return { features, labels };
}
// --- Hyperparameter Tuning ---
// We can define different settings for different models based on their data size and complexity
const modelOptions = {
    'base': { nEstimators: 150, maxFeatures: 0.8, seed: 42 },
    'short_efficient': { nEstimators: 50, maxFeatures: 1.0, seed: 42 },
    'high_receipts': { nEstimators: 250, maxFeatures: 0.6, seed: 42 },
    'default': { nEstimators: 100, maxFeatures: 0.8, seed: 42 }
};
function trainAndSaveModel(name, data) {
    if (data.features.length < 10) {
        console.warn(`Skipping training for ${name} due to insufficient data (${data.features.length} samples).`);
        return;
    }
    console.log(`Training ${name} model with ${data.features.length} samples...`);
    const options = modelOptions[name] || modelOptions['default'];
    const model = new ml_random_forest_1.RandomForestRegression(options);
    model.train(data.features, data.labels);
    const savedModel = model.toJSON();
    fs.writeFileSync(`./models/${name}_model.json`, JSON.stringify(savedModel));
    console.log(`${name} model trained and saved with options:`, options);
}
const milesPerDay = (t) => t.days > 0 ? t.miles / t.days : 0;
// To retrain all models, uncomment the block below.
// For a targeted fix, we are only retraining the model identified in the error analysis.
/*
const segments: { name: string; filter: (trip: Trip) => boolean }[] = [
    { name: 'base', filter: () => true, },
    { name: 'short_inefficient', filter: (t: Trip) => t.days <= 2 && milesPerDay(t) < 50, },
    { name: 'short_efficient', filter: (t: Trip) => t.days <= 2 && milesPerDay(t) >= 100, },
    { name: 'mid_length', filter: (t: Trip) => t.days > 2 && t.days <= 6, },
    { name: 'long_haul', filter: (t: Trip) => t.days >= 7 && milesPerDay(t) >= 100, },
    { name: 'long_conference', filter: (t: Trip) => t.days >= 7 && milesPerDay(t) < 50, },
    { name: 'high_receipts', filter: (t: Trip) => t.receipts > 1200, },
    { name: 'five_day_bonus', filter: (t: Trip) => t.days === 5, }
];

segments.forEach(segment => {
    const data = prepareData(segment.filter);
    trainAndSaveModel(segment.name, data);
});
console.log('All specialist models have been trained.');
*/
// Train only the high_receipts model for this targeted fix.
const highReceiptsSegment = {
    name: 'high_receipts',
    filter: (t) => t.receipts > 1200,
};
const data = prepareData(highReceiptsSegment.filter);
trainAndSaveModel(highReceiptsSegment.name, data);
console.log('High receipts model has been retrained.');
