
export enum NodeType {
  METER = 'METER',
  JUNCTION = 'JUNCTION',
  MANIFOLD = 'MANIFOLD',
  APPLIANCE = 'APPLIANCE'
}

export enum PipeSize {
  THREE_EIGHTHS = '3/8"',
  HALF = '1/2"',
  THREE_QUARTERS = '3/4"',
  ONE = '1"',
  ONE_AND_QUARTER = '1-1/4"'
}

export interface PipeData {
  size: PipeSize;
  coeff: number; // Constant1 in the flow formula
  exp: number;   // Constant2 in the flow formula
  capacity: number; // Nominal capacity in BTU for display (approx @ 10ft/0.5" WC drop)
}

export interface AppNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  name: string;
  btu: number; // Only for appliances
  supplyPressure?: string; // Only for Meter
  gasType?: 'Natural' | 'Propane'; // Only for Meter
}

export interface AppEdge {
  id: string;
  from: string;
  to: string;
  size: PipeSize;
  length: number; // Feet
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  totalBTU: number;
}
