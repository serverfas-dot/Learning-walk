export interface FormConfig {
  id: string;
  title: string;
  description: string;
  theme_color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormSection {
  id: string;
  form_id: string;
  title: string;
  description: string;
  order_index: number;
  created_at: string;
  updated_at: string;
  fields?: FormField[];
}

export type FieldType = 'text' | 'email' | 'textarea' | 'radio' | 'checkbox' | 'select' | 'number' | 'date' | 'phone';

export interface FormField {
  id: string;
  section_id: string;
  field_type: FieldType;
  label: string;
  placeholder: string;
  helper_text: string;
  required: boolean;
  options: string[];
  order_index: number;
  created_at: string;
  updated_at: string;
}

export type SubmissionStatus = 'new' | 'reviewed' | 'resolved';

export interface FormSubmission {
  id: string;
  form_id: string;
  submitter_name: string;
  submitter_email: string;
  status: SubmissionStatus;
  notes: string;
  submitted_at: string;
  created_at: string;
  answers?: SubmissionAnswer[];
}

export interface SubmissionAnswer {
  id: string;
  submission_id: string;
  field_id: string | null;
  field_label: string;
  field_type: string;
  answer: string;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'admin' | 'super_admin';
  created_at: string;
}

export type AdminRole = 'admin' | 'super_admin' | null;
