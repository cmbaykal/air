export interface CatalogEntry {
  id: string;
  title: string;
  port: number;
  defaultEnabled: boolean;
}

export interface CatalogFile {
  servers: CatalogEntry[];
}

export interface UserPrefs {
  enabled: string[];
}

export interface EnvField {
  key: string;
  label: string;
  secret?: boolean;
  helpUrl?: string;
}

export interface DetectResult {
  ok: boolean;
  message?: string;
}

export interface McpAdapter {
  id: string;
  title: string;
  port: number;
  url: string;
  requiredEnv: EnvField[];
  detect(): Promise<DetectResult>;
  install(): Promise<DetectResult>;
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): Promise<boolean>;
  validateEnv?(): Promise<DetectResult>;
}
