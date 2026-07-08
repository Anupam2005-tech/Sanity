export interface CRMRecord {
  created_at?: string | null;
  name?: string | null;
  email?: string | null;
  country_code?: string | null;
  mobile_without_country_code?: string | null;
  company?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  lead_owner?: string | null;
  crm_status?: string | null;
  crm_note?: string | null;
  data_source?: string | null;
  possession_time?: string | null;
  description?: string | null;
}

export interface SkippedRecord {
  index: number;
  reason: string;
  rawRow?: Record<string, any>;
}

export interface ImportCreateRequest {
  rows: Record<string, any>[];
  filename?: string;
}

export interface ImportCreateResponse {
  importId: string;
  totalRows: number;
}

export interface ImportProcessResponse {
  importId: string;
  records: CRMRecord[];
  skipped: SkippedRecord[];
  totalImported: number;
  totalSkipped: number;
}

export interface ImportStatusResponse {
  id: string;
  filename: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  batchesCompleted: number;
  batchesTotal: number;
  records?: CRMRecord[];
  skipped?: SkippedRecord[];
}
