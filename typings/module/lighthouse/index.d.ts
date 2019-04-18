import { Threshold } from '@/typings/utils/threshold';

export interface AuditRef {
  group?: string;
  id: string;
  weight: number;
}

export interface Category {
  auditRefs: AuditRef[];
  description?: string;
  id: string;
  manualDescription?: string;
  score: number;
  title: string;
}

export interface Categories {
  [name: string]: Category;
}

export interface ConfigSettings {
  skipAudits?: string[];
}

export interface Config {
  extends?: string;
  settings?: ConfigSettings;
  threshold: Threshold;
}

export interface Options {
  chromePort: string;
}

export interface Result {
  audits: {};
  categories: Categories;
  categoryGroups: {};
  configSettings: {};
  environment: {};
  fetchTime: string;
  finalUrl: string;
  i18n: {};
  lighthouseVersion: string;
  requestedUrl: string;
  runWarnings: string[];
  success: boolean;
  timing: {};
  userAgent: string;
}
