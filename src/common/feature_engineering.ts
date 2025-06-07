import { Trip } from "./interfaces";

export function engineerFeatures(trip: Trip): number[] {
  const { days, miles, receipts } = trip;

  // Basic features
  const miles_per_day = days > 0 ? miles / days : 0;
  const receipts_per_day = days > 0 ? receipts / days : 0;
  const miles_per_receipt_dollar = receipts > 0 ? miles / receipts : 0;

  // Logarithmic transformations to handle skewed data and diminishing returns
  const log_days = Math.log(days + 1);
  const log_miles = Math.log(miles + 1);
  const log_receipts = Math.log(receipts + 1);

  // Polynomial features to model non-linear relationships
  const days_sq = days ** 2;
  const miles_sq = miles ** 2;
  const receipts_sq = receipts ** 2;

  // Categorical/Boolean features based on interviews
  const is_long_trip = days > 7 ? 1 : 0;
  const is_short_trip = days <= 2 ? 1 : 0;
  const has_high_receipts = receipts > 1200 ? 1 : 0;
  const has_low_receipts = receipts < 100 ? 1 : 0;
  const is_5_day_trip = days === 5 ? 1 : 0;
  const is_efficient = miles_per_day > 150 ? 1 : 0;
  const is_inefficient = days > 3 && miles_per_day < 50 ? 1 : 0;
  
  // Tiered features for non-linear relationships
  const mileage_tier1 = Math.min(miles, 100);
  const mileage_tier2 = Math.max(0, Math.min(miles - 100, 400));
  const mileage_tier3 = Math.max(0, miles - 500);
  
  const receipts_tier1 = Math.min(receipts, 500);
  const receipts_tier2 = Math.max(0, Math.min(receipts - 500, 1000));
  const receipts_tier3 = Math.max(0, receipts - 1500);

  // Advanced Interaction features
  const days_x_miles = days * miles;
  const days_x_receipts = days * receipts;
  const miles_x_receipts = miles * receipts;
  
  // *** New Hyper-Specific Features ***
  const receipt_to_mileage_ratio = miles > 0 ? receipts / miles : 0;
  const is_high_receipt_and_inefficient = (has_high_receipts && is_inefficient) ? 1 : 0;
  const cents = receipts - Math.floor(receipts);
  const is_49_or_99_cents = (Math.abs(cents - 0.49) < 0.001 || Math.abs(cents - 0.99) < 0.001) ? 1 : 0;
  
  return [
    days,
    miles,
    receipts,
    miles_per_day,
    receipts_per_day,
    miles_per_receipt_dollar,
    log_days,
    log_miles,
    log_receipts,
    days_sq,
    miles_sq,
    receipts_sq,
    is_long_trip,
    is_short_trip,
    has_high_receipts,
    has_low_receipts,
    is_5_day_trip,
    is_efficient,
    is_inefficient,
    receipt_to_mileage_ratio,
    is_high_receipt_and_inefficient,
    is_49_or_99_cents,
    mileage_tier1,
    mileage_tier2,
    mileage_tier3,
    receipts_tier1,
    receipts_tier2,
    receipts_tier3,
    days_x_miles,
    days_x_receipts,
    miles_x_receipts,
  ];
} 