export type UserRole = "client" | "bank";

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

export type LegalForm = "IP" | "OOO";

export interface Okved {
  id: number;
  code: string;
  name: string;
}

export interface Company {
  id: number;
  legal_form: LegalForm;
  name: string;
  inn: string;
  ogrn: string;
  okved: Okved;
  revenue: number;
  declared_profit: number;
  employees: number;
  business_age_months: number;
  has_overdue: boolean;
}

export interface User {
  id: number;
  email: string;
  role: UserRole;
  full_name: string;
  company: Company | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export type RepaymentType = "annuity" | "differentiated";

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
  repayment_type: RepaymentType;
  is_revolving: boolean;
}

export interface ClientProfile {
  id: number;
  email: string;
  full_name: string;
  company: Company | null;
}

export interface FinancialVerification {
  official_revenue: number;
  official_profit: number;
  revenue_diff_pct: number;
  profit_diff_pct: number;
  flags: string[];
}

export interface BkiCheck {
  bki_score: number;
  active_loans: number;
  monthly_payments: number;
  overdue_count: number;
  payment_discipline_pct: number;
}

export interface AiCheck {
  is_purpose_valid: boolean;
  ai_comment: string;
  similarity_score: number;
}

export interface ScoringFactor {
  factor: string;
  label: string;
  value: string;
  points: number;
  description: string;
}

export interface ScoringResult {
  score: number;
  dti_percent: number;
  factors: ScoringFactor[];
}

export interface StatusHistoryItem {
  id: number;
  status: ApplicationStatus;
  comment: string;
  actor_role: "client" | "bank" | "system";
  created_at: string;
}

export interface Decision {
  decision: string;
  decision_reason: string | null;
}

export interface Approval {
  approved_amount: number | null;
  approved_term_months: number | null;
  approved_rate: number | null;
}

export interface ApplicationListItem {
  id: number;
  product: Product;
  client: ClientProfile;
  amount: number;
  term_months: number;
  purpose: string;
  status: ApplicationStatus;
  score: number | null;
  decision: Decision | null;
  approval: Approval | null;
  counter_offer_amount: number | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
}

export interface ApplicationDetail extends ApplicationListItem {
  financial_verification: FinancialVerification | null;
  bki_check: BkiCheck | null;
  ai_check: AiCheck | null;
  scoring_result: ScoringResult | null;
  status_history: StatusHistoryItem[];
}

export interface ApplicationCreateInput {
  product_id: number;
  amount: number;
  term_months: number;
  purpose: string;
}

export interface BankDecisionInput {
  decision: "APPROVED" | "REJECTED" | "MANUAL_REVIEW";
  comment?: string;
  approved_amount?: number;
  approved_term_months?: number;
  approved_rate?: number;
}
