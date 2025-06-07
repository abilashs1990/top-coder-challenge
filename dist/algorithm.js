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
exports.calculateReimbursement = calculateReimbursement;
const fs = __importStar(require("fs"));
const ml_random_forest_1 = require("ml-random-forest");
const feature_engineering_1 = require("./common/feature_engineering");
// --- Model Loading ---
const models = {};
if (fs.existsSync('./models')) {
    const modelFiles = fs.readdirSync('./models');
    modelFiles.forEach(file => {
        if (file.endsWith('_model.json')) {
            const name = file.replace('_model.json', '');
            const modelJson = fs.readFileSync(`./models/${file}`, 'utf-8');
            models[name] = ml_random_forest_1.RandomForestRegression.load(JSON.parse(modelJson));
        }
    });
}
// --- Rule-Based Adjustments & Penalties ---
function applyRuleBasedAdjustments(trip, prediction, specialistModels) {
    let adjustedAmount = prediction;
    // Sanity Check Cap: Only apply this for trips that triggered the high_receipts model.
    const isHighReceiptTrip = specialistModels.includes('high_receipts');
    if (isHighReceiptTrip) {
        const reasonableMax = (trip.receipts * 0.8) + (trip.miles * 0.5) + (trip.days * 100);
        if (adjustedAmount > reasonableMax * 1.2) {
            adjustedAmount = reasonableMax;
        }
    }
    // Rounding bug/feature for .49/.99 cents (from Lisa in Accounting)
    const cents = trip.receipts - Math.floor(trip.receipts);
    if (Math.abs(cents - 0.49) < 0.001 || Math.abs(cents - 0.99) < 0.001) {
        adjustedAmount += 10;
    }
    // Vacation Penalty for inefficient long trips (from Marcus and Lisa)
    const efficiency = trip.days > 0 ? trip.miles / trip.days : 0;
    if (trip.days > 3 && efficiency < 25) {
        adjustedAmount -= 200;
    }
    // Low receipt penalty for multi-day trips (from Lisa)
    if (trip.days > 1 && trip.receipts > 0 && trip.receipts < 60) {
        adjustedAmount -= 100;
    }
    return Math.round(adjustedAmount);
}
const milesPerDay = (t) => t.days > 0 ? t.miles / t.days : 0;
// --- Main Calculation Logic ---
function calculateReimbursement(trip) {
    if (Object.keys(models).length === 0) {
        // Failsafe if no models are loaded. This might happen if training hasn't been run.
        console.error("No models found. Please run 'npm run train' first.");
        return 0;
    }
    const features = (0, feature_engineering_1.engineerFeatures)(trip);
    const predictions = [];
    const specialistModels = [];
    // --- Prediction Gathering ---
    // Get predictions from all models whose segments match the trip
    if (trip.days <= 2 && milesPerDay(trip) < 50)
        predictions.push({ name: 'short_inefficient', value: models.short_inefficient.predict([features])[0] });
    if (trip.days <= 2 && milesPerDay(trip) >= 100)
        predictions.push({ name: 'short_efficient', value: models.short_efficient.predict([features])[0] });
    if (trip.days > 2 && trip.days <= 6)
        predictions.push({ name: 'mid_length', value: models.mid_length.predict([features])[0] });
    if (trip.days >= 7 && milesPerDay(trip) >= 100)
        predictions.push({ name: 'long_haul', value: models.long_haul.predict([features])[0] });
    if (trip.days >= 7 && milesPerDay(trip) < 50)
        predictions.push({ name: 'long_conference', value: models.long_conference.predict([features])[0] });
    if (trip.receipts > 1200) {
        specialistModels.push('high_receipts');
    }
    if (trip.days === 5) {
        specialistModels.push('five_day_bonus');
    }
    // --- Prediction Blending ---
    let rawPrediction;
    const basePrediction = models.base.predict([features])[0];
    if (predictions.length === 0) {
        // If no specialist model matches, use the base model
        rawPrediction = basePrediction;
    }
    else {
        // Weighted average: 40% base model, 60% average of specialists
        const specialistAverage = predictions.reduce((acc, p) => acc + p.value, 0) / predictions.length;
        rawPrediction = 0.4 * basePrediction + 0.6 * specialistAverage;
    }
    return applyRuleBasedAdjustments(trip, rawPrediction, specialistModels);
}
