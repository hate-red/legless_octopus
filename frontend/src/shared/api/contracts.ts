export type UserRole = "client" | "bank";
export interface Okved {
  id: number;
  code: string;
  name: string;
}
export interface Company {
  id: number;
  legal_form: "OOO" | "IP";
  name: string;
  inn: string;
  ogrn: string;
  okved: Okved;
  revenue: number;
  declared_profit: number;
  employees: number;
  business_age_months: number;
  has_overdue: boolean;
  details: Record<string, string>;
}
export interface User {
  id: number;
  email: string;
  role: UserRole;
  full_name: string;
  company: Company | null;
}
export type ClientProfile = Omit<User, "role">;
export interface Product {
  id: number;
  code: string;
  name: string;
  description: string;
  min_amount: number;
  max_amount: number;
  min_term_months: number;
  max_term_months: number;
  base_rate: number;
  collateral_required: boolean;
  repayment_type: "annuity" | "differentiated";
  is_revolving: boolean;
}
export type ApplicationStatus =
  | "DRAFT"
  | "VALIDATION"
  | "ENRICHMENT"
  | "AI_PURPOSE_CHECK"
  | "SCORING"
  | "APPROVED"
  | "COUNTER_OFFER"
  | "MANUAL_REVIEW"
  | "REJECTED"
  | "CONTRACT_SIGNING"
  | "DISBURSED";
export interface Approval {
  approved_amount: number | null;
  approved_term_months: number | null;
  approved_rate: number | null;
}
export interface HistoryEntry {
  id: number;
  status: ApplicationStatus;
  comment: string;
  actor_role: string;
  created_at: string;
}
export interface ScoringFactor {
  factor: string;
  label: string;
  value: string;
  points: number;
  description: string;
}
export interface Application {
  id: number;
  product: Product;
  client: ClientProfile;
  amount: number;
  term_months: number;
  purpose: string;
  status: ApplicationStatus;
  score: number | null;
  decision: { decision: string; decision_reason: string | null } | null;
  approval: Approval | null;
  counter_offer_amount: number | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  documents_confirmed_at: string | null;
}
export interface ApplicationDetail extends Application {
  financial_verification: {
    official_revenue: number;
    official_profit: number;
    revenue_diff_pct: number;
    profit_diff_pct: number;
    flags: string[];
  } | null;
  bki_check: {
    bki_score: number;
    active_loans: number;
    monthly_payments: number;
    overdue_count: number;
    payment_discipline_pct: number;
  } | null;
  ai_check: {
    is_purpose_valid: boolean;
    ai_comment: string;
    similarity_score: number;
  } | null;
  scoring_result: {
    score: number;
    dti_percent: number;
    factors: ScoringFactor[];
  } | null;
  status_history: HistoryEntry[];
}
export type DocumentKind = "company" | "statement" | "finance";
export interface CompanyDocument {
  id: string;
  kind: DocumentKind;
  title: string;
  filename: string;
  period: string;
  size: number;
  uploaded_at: string;
}
export interface Notification {
  id: number;
  title: string;
  message: string;
  application_id: number;
  created_at: string;
  read: boolean;
}
export interface LoanValues {
  product_id: number;
  amount: number;
  term_months: number;
  purpose: string;
}
