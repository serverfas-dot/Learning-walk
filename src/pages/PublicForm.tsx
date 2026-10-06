import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { FormConfig, FormSection, FormField } from '../types';
import { CheckCircle, AlertCircle, ChevronRight, ClipboardList, MoreVertical, LayoutDashboard, Shield } from 'lucide-react';

interface Props {
  onNavigate: (page: 'form' | 'login' | 'admin' | 'super-admin') => void;
}

export default function PublicForm({ onNavigate }: Props) {
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [sections, setSections] = useState<(FormSection & { fields: FormField[] })[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitterName, setSubmitterName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { loadForm(); }, []);

  async function loadForm() {
    try {
      const { data: cfgData } = await supabase
        .from('form_config')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (!cfgData) return;
      setConfig(cfgData);

      const { data: sectData } = await supabase
        .from('form_sections')
        .select('*, fields:form_fields(*)')
        .eq('form_id', cfgData.id)
        .order('order_index');

      if (sectData) {
        const sorted = sectData.map((s: FormSection & { fields: FormField[] }) => ({
          ...s,
          fields: [...(s.fields || [])].sort((a, b) => a.order_index - b.order_index),
        }));
        setSections(sorted);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleChange(fieldId: string, value: string | string[]) {
    setAnswers(prev => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) setErrors(prev => { const e = { ...prev }; delete e[fieldId]; return e; });
  }

  function handleCheckbox(fieldId: string, option: string, checked: boolean) {
    setAnswers(prev => {
      const current = (prev[fieldId] as string[] | undefined) || [];
      return {
        ...prev,
        [fieldId]: checked ? [...current, option] : current.filter(v => v !== option),
      };
    });
    if (errors[fieldId]) setErrors(prev => { const e = { ...prev }; delete e[fieldId]; return e; });
  }

  function validate() {
    const newErrors: Record<string, string> = {};
    for (const section of sections) {
      for (const field of section.fields) {
        if (field.required) {
          const val = answers[field.id];
          const empty = !val || (Array.isArray(val) ? val.length === 0 : val.trim() === '');
          if (empty) newErrors[field.id] = 'This field is required';
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !config) return;
    setSubmitting(true);

    try {
      const allFields = sections.flatMap(s => s.fields);
      const leadingTeacherField = allFields.find(f => f.label.toLowerCase().includes('leading'));
      const classField = allFields.find(f => f.label.toLowerCase() === 'class');
      const emailField = allFields.find(f => f.field_type === 'email');
      const leadingTeacher = leadingTeacherField ? (answers[leadingTeacherField.id] as string) || '' : '';
      const classVal = classField ? (answers[classField.id] as string) || '' : '';
      const submitterNameVal = [leadingTeacher, classVal].filter(Boolean).join(' — ') || 'Observer';
      const submitterEmailVal = emailField ? (answers[emailField.id] as string) || '' : '';

      const { data: submission, error } = await supabase
        .from('form_submissions')
        .insert({
          form_id: config.id,
          submitter_name: submitterNameVal,
          submitter_email: submitterEmailVal,
          status: 'new',
        })
        .select()
        .single();

      if (error || !submission) return;

      const answerRows = allFields.map(field => {
        const val = answers[field.id];
        return {
          submission_id: submission.id,
          field_id: field.id,
          field_label: field.label,
          field_type: field.field_type,
          answer: Array.isArray(val) ? val.join(', ') : (val || ''),
        };
      });

      await supabase.from('submission_answers').insert(answerRows);
      setSubmitterName(submitterNameVal);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  const BG = 'linear-gradient(180deg, #bfdbfe 0%, #93c5fd 40%, #60a5fa 100%)';
  const ACCENT = 'linear-gradient(135deg, #2563eb, #0ea5e9)';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-blue-500 text-sm font-medium">Loading form...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-blue-300 mx-auto mb-3" />
          <p className="text-blue-500">Form is currently unavailable.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: BG }}>
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5 ring-4 ring-emerald-100">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Observation Recorded!</h2>
          <p className="text-gray-500 leading-relaxed mb-6">
            Your learning walk entry has been saved successfully
            {submitterName ? <><br /><span className="font-medium text-gray-700">{submitterName}</span></> : ''}.
          </p>
          <button
            onClick={() => { setSubmitted(false); setAnswers({}); setErrors({}); }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold transition-all hover:shadow-lg hover:scale-[1.02] active:scale-100"
            style={{ background: ACCENT }}
          >
            Submit another response <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen" style={{ background: BG }}>

      <div className="relative max-w-2xl mx-auto py-6 sm:py-10 px-3 sm:px-4">
        {/* Form header card */}
        <div className="rounded-3xl mb-4 sm:mb-5 border border-green-200 shadow-lg shadow-green-200/50 overflow-hidden" style={{ background: 'linear-gradient(135deg, #bbf7d0 0%, #86efac 100%)' }}>
          <div className="p-5 sm:p-8">
            <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: ACCENT }}>
                <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-green-900 leading-tight">{config.title}</h1>
                {config.description && <p className="text-green-700 text-xs sm:text-sm mt-0.5">{config.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-green-700 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
              Required fields are marked with an asterisk (*)
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-3 sm:space-y-4">
          {sections.map((section, idx) => (
            <div key={section.id} className="bg-blue-50 rounded-3xl shadow-md shadow-blue-100/50 overflow-hidden border border-blue-100">
              {section.title && (
                <div className="px-5 sm:px-7 pt-4 sm:pt-5 pb-3 sm:pb-4" style={{ background: 'linear-gradient(135deg, #2563eb, #0ea5e9)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-white/20">
                      {idx + 1}
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-semibold text-white">{section.title}</h2>
                      {section.description && <p className="text-xs text-blue-100 mt-0.5">{section.description}</p>}
                    </div>
                  </div>
                </div>
              )}
              <div className="p-4 sm:p-7 space-y-5 sm:space-y-6">
                {section.fields.map(field => (
                  <FieldRenderer
                    key={field.id}
                    field={field}
                    value={answers[field.id]}
                    error={errors[field.id]}
                    onChange={(v) => handleChange(field.id, v)}
                    onCheckbox={(opt, checked) => handleCheckbox(field.id, opt, checked)}
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-0 sm:justify-between pt-2 pb-8">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-8 sm:px-10 py-3.5 rounded-2xl text-white font-semibold text-sm transition-all hover:shadow-xl hover:scale-[1.02] active:scale-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2 shadow-lg shadow-blue-300/40"
              style={{ background: submitting ? '#94a3b8' : ACCENT }}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : 'Submit Observation'}
            </button>
            <button
              type="button"
              onClick={() => { setAnswers({}); setErrors({}); }}
              className="text-sm text-blue-400 hover:text-blue-600 transition-colors underline underline-offset-2 text-center sm:text-left"
            >
              Clear form
            </button>
          </div>
        </form>

        <div className="flex items-center justify-between pb-6">
          <p className="text-xs text-blue-300">Powered by Faafu Atoll School</p>
          <DotsMenu menuOpen={menuOpen} setMenuOpen={setMenuOpen} menuRef={menuRef} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

// ─── Three-dots menu ──────────────────────────────────────────────────────────

interface DotsMenuProps {
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  menuRef: React.RefObject<HTMLDivElement>;
  onNavigate: (page: 'form' | 'login' | 'admin' | 'super-admin') => void;
}

function DotsMenu({ menuOpen, setMenuOpen, menuRef, onNavigate }: DotsMenuProps) {
  return (
    <div ref={menuRef} className="relative">
      {menuOpen && (
        <div className="absolute bottom-10 right-0 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden min-w-52 py-1 z-50">
          <div className="px-4 py-2 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Staff Access</p>
          </div>
          <button
            onClick={() => { setMenuOpen(false); onNavigate('admin'); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Admin Dashboard</p>
              <p className="text-xs text-gray-400">View submissions & reports</p>
            </div>
          </button>
          <button
            onClick={() => { setMenuOpen(false); onNavigate('super-admin'); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <Shield className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Super Admin</p>
              <p className="text-xs text-gray-400">Form builder & full control</p>
            </div>
          </button>
        </div>
      )}
      <button
        onClick={() => setMenuOpen(v => !v)}
        className="w-10 h-10 flex items-center justify-center transition-all text-gray-500 hover:text-gray-800 active:scale-90"
      >
        <MoreVertical className="w-5 h-5" />
      </button>
    </div>
  );
}

// ─── Field Renderer ───────────────────────────────────────────────────────────

interface FieldProps {
  field: FormField;
  value: string | string[] | undefined;
  error?: string;
  onChange: (v: string) => void;
  onCheckbox: (option: string, checked: boolean) => void;
}

function FieldRenderer({ field, value, error, onChange, onCheckbox }: FieldProps) {
  const inputBase = `w-full px-4 py-3 sm:py-2.5 rounded-xl border text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all ${
    error ? 'border-red-300 bg-red-50 focus:ring-red-300' : 'border-gray-200 hover:border-gray-300'
  }`;

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {field.label}
        {field.required && <span className="text-red-400 ml-1">*</span>}
      </label>

      {(field.field_type === 'text' || field.field_type === 'phone' || field.field_type === 'number') && (
        <input
          type={field.field_type === 'number' ? 'number' : 'text'}
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputBase}
        />
      )}

      {field.field_type === 'email' && (
        <input
          type="email"
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputBase}
        />
      )}

      {field.field_type === 'date' && (
        <input
          type="date"
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          className={inputBase}
        />
      )}

      {field.field_type === 'textarea' && (
        <textarea
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className={`${inputBase} resize-none`}
        />
      )}

      {field.field_type === 'select' && (
        <select
          value={(value as string) || ''}
          onChange={e => onChange(e.target.value)}
          className={inputBase}
        >
          <option value="">— Select an option —</option>
          {field.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      {field.field_type === 'radio' && (
        <div className="space-y-2 mt-1">
          {field.options.map(opt => (
            <label
              key={opt}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                (value as string) === opt
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
              }`}
            >
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={(value as string) === opt}
                onChange={() => onChange(opt)}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-sm text-gray-700">{opt}</span>
            </label>
          ))}
        </div>
      )}

      {field.field_type === 'checkbox' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
          {field.options.map(opt => {
            const checked = Array.isArray(value) && (value as string[]).includes(opt);
            return (
              <label
                key={opt}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  checked
                    ? 'border-teal-400 bg-teal-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => onCheckbox(opt, e.target.checked)}
                  className="w-4 h-4 rounded accent-teal-600 flex-shrink-0"
                />
                <span className="text-sm text-gray-700 leading-tight">{opt}</span>
              </label>
            );
          })}
        </div>
      )}

      {field.helper_text && !error && (
        <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">{field.helper_text}</p>
      )}
      {error && (
        <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />{error}
        </p>
      )}
    </div>
  );
}
