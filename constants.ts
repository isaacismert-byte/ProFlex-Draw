
import { PipeSize, PipeData } from './types';

/**
 * Pipe coefficients based on the user-provided formula:
 * Capacity (CFH) = INT( ((Drop / Length) / Constant1) ^ (1 / Constant2) )
 */
export const PIPE_SPECS: Record<PipeSize, PipeData> = {
  [PipeSize.THREE_EIGHTHS]: { 
    size: PipeSize.THREE_EIGHTHS, 
    coeff: 0.00002158927,
    exp: 2.02558185,
    capacity: 46000 
  },
  [PipeSize.HALF]: { 
    size: PipeSize.HALF, 
    coeff: 0.00000410606, 
    exp: 2.1590935,
    capacity: 77000 
  },
  [PipeSize.THREE_QUARTERS]: { 
    size: PipeSize.THREE_QUARTERS, 
    coeff: 0.00000123682, 
    exp: 2.00156167,
    capacity: 200000
  },
  [PipeSize.ONE]: { 
    size: PipeSize.ONE, 
    coeff: 0.0000010746, 
    exp: 1.77654817,
    capacity: 423000
  },
  [PipeSize.ONE_AND_QUARTER]: { 
    size: PipeSize.ONE_AND_QUARTER, 
    coeff: 1.1678553403503E-07, 
    exp: 1.992081557687,
    capacity: 662000
  },
};

export const PIPE_ORDER: PipeSize[] = [
  PipeSize.THREE_EIGHTHS,
  PipeSize.HALF,
  PipeSize.THREE_QUARTERS,
  PipeSize.ONE,
  PipeSize.ONE_AND_QUARTER
];

export const DEFAULT_APPLIANCES = [
  { name: 'Furnace', btu: 100000 },
  { name: 'Water Heater', btu: 40000 },
  { name: 'Cooktop', btu: 65000 },
  { name: 'Fireplace', btu: 30000 },
  { name: 'Dryer', btu: 20000 }
];

export const COLORS = {
  METER: '#10b981', // Emerald 500
  JUNCTION: '#6366f1', // Indigo 500
  MANIFOLD: '#06b6d4', // Cyan 500
  APPLIANCE: '#f59e0b', // Amber 500
  ERROR: '#ef4444', // Red 500
  SUCCESS: '#10b981', // Emerald 500
  PIPE: '#64748b' // Slate 500
};
