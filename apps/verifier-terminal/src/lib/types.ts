export type TerminalState = 'scanning' | 'verifying' | 'granted' | 'denied';

export interface AccessLogEntry {
  id: string;
  timestamp: Date;
  granted: boolean;
  credentialType: string;
  holderName: string;
  reason?: string;
}

export interface VerificationResult {
  granted: boolean;
  reason?: string;
  credentialType?: string;
  holderName?: string;
}

export interface DemoScenario {
  label: string;
  type: string;
  granted: boolean;
  reason?: string;
  holderName: string;
}
