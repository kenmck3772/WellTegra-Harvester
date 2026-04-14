
export type TruthLevel = 'Public' | 'Forensic' | 'Hybrid';

export interface ForensicAudit {
  id: string;
  wellId: string;
  timestamp: string;
  reportedProduction: number; // bbl/d
  forensicProduction: number; // bbl/d
  discrepancy: number; // percentage
  confidenceScore: number; // 0-1
  source: string;
  validationEngine: string;
  notes: string;
  physicsCalculations?: {
    massBalanceDelta: number;
    sensorDriftFactor: number;
    pValue: number;
    iterations: number;
  };
}

export interface Asset {
  id: string;
  name: string;
  location: string;
  status: 'Active' | 'Decommissioned' | 'Under Audit';
  lastAuditDate: string;
}

export interface TimelineEvent {
  id: string;
  wellId: string;
  date: string;
  type: 'Water Breakthrough' | 'Pressure Drop' | 'Sensor Drift' | 'Maintenance';
  description: string;
  truthLevel: TruthLevel;
}
