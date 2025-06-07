export interface Trip {
  days: number;
  miles: number;
  receipts: number;
}

export interface Case {
  case_id: string;
  input: {
    trip_duration_days: number;
    miles_traveled: number;
    total_receipts_amount: number;
  };
  expected_output: number;
}

export interface Reimbursement {
  amount: number;
}

export interface TrainingData {
    features: number[][];
    labels: number[];
} 