import { CommandOptions } from '@/typings/utils/command';

export type ReportThresholdLimit = 'lower' | 'upper';

export interface ReportError {
  message: string;
  stack: string[];
}

export interface ReportItem {
  data?: ReportItem[];
  label: string;
  lastValue?: number | string;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  raw?: any;
  rawLabel: string;
  rawLastValue?: number | string;
  rawThreshold?: number | string;
  rawValue?: number | string;
  threshold?: number | string;
  thresholdLimit?: ReportThresholdLimit;
  value?: number | string;
  success: boolean;
  type: string;
}

export interface Report {
  error?: ReportError;
  data?: ReportItem[];
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  raw?: any;
  rawReports?: Report[];
  success: boolean;
}

export interface StartEvent {
  args: string[];
  commandOptions: CommandOptions;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  command: any; // would cause circular dependency if imported the command class
}

export interface EndEvent {
  args: string[];
  commandOptions: CommandOptions;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  command: any; // would cause circular dependency if imported the command class
  report: Report;
}

export interface ActionStartEvent {
  args: string[];
  commandOptions: CommandOptions;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  command: any; // would cause circular dependency if imported the command class
}

export interface ActionEndEvent {
  args: string[];
  commandOptions: CommandOptions;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  command: any; // would cause circular dependency if imported the command class
  report: Report;
}
