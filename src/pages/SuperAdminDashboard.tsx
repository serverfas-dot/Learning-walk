import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { FormConfig, FormSection, FormField, FieldType, AdminUser, FormSubmission, SubmissionAnswer, SubmissionStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  Settings, LogOut, Eye, LayoutList, Users, Download, Upload,
  Plus, Trash2, Edit2, Check, X, ChevronUp, ChevronDown,
  GripVertical, FileText, AlertTriangle, Shield, ArrowLeft,
  Save, Database, ToggleLeft, ToggleRight, ChevronRight
} from 'lucide-react';

interface Props {
  onNavigate: (page: 'form' | 'login' | 'admin' | 'super-admin') => void;
}

type Tab = 'form-builder' | 'submissions' | 'admins' | 'settings';

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Short Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'radio', label: 'Multiple Choice' },
  { value: 'checkbox', label: 'Checkboxes' },
  { value: 'select', label: 'Dropdown' },
];

function formatDT(d: string) {
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SuperAdminDashboard({ onNavigate }: Props) {
  const { signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('form-builder');
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [sections, setSections] = useState<(FormSection & { fields: FormField[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { loadAll(); }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function loadAll() {
    const [cfgRes, sectRes, adminRes] = await Promise.all([
      supabase.from('form_config').select('*').maybeSingle(),
      supabase.from('form_sections').select('*, fields:form_fields(*)').order('order_index'),
      supabase.from('admin_users').select('*').order('created_at'),
    ]);
    setConfig(cfgRes.data);
    if (sectRes.data) {
      setSections(sectRes.data.map((s: FormSection & { fields: FormField[] }) => ({
        ...s,
        fields: [...(s.fields || [])].sort((a, b) => a.order_index - b.order_index).map(f => ({
          ...f,
          placeholder: f.placeholder ?? '',
          helper_text: f.helper_text ?? '',
          options: f.options ?? [],
        })),
      })));
    }
    setAdmins(adminRes.data || []);
    setLoading(false);
  }

  // ─── Form config ──────────────────────────────────────────────
  async function saveConfig() {
    if (!config) return;
    setSaving(true);
    await supabase.from('form_config').update({
      title: config.title, description: config.description,
      theme_color: config.theme_color, is_active: config.is_active,
      updated_at: new Date().toISOString(),
    }).eq('id', config.id);
    setSaving(false);
    showToast('Form settings saved');
  }

  // ─── Sections ─────────────────────────────────────────────────
  async function addSection() {
    if (!config) return;
    const { data } = await supabase.from('form_sections').insert({
      form_id: config.id, title: 'New Section', description: '', order_index: sections.length,
    }).select().single();
    if (data) setSections(prev => [...prev, { ...data, fields: [] }]);
  }

  async function updateSection(id: string, patch: Partial<FormSection>) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  async function saveSection(id: string) {
    const sec = sections.find(s => s.id === id);
    if (!sec) return;
    await supabase.from('form_sections').update({ title: sec.title, description: sec.description, updated_at: new Date().toISOString() }).eq('id', id);
    showToast('Section saved');
  }

  async function deleteSection(id: string) {
    if (!confirm('Delete this section and all its fields?')) return;
    await supabase.from('form_sections').delete().eq('id', id);
    setSections(prev => prev.filter(s => s.id !== id));
    showToast('Section deleted');
  }

  async function moveSectionUp(idx: number) {
    if (idx === 0) return;
    const arr = [...sections];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    const updated = arr.map((s, i) => ({ ...s, order_index: i }));
    setSections(updated);
    await Promise.all(updated.map(s => supabase.from('form_sections').update({ order_index: s.order_index }).eq('id', s.id)));
  }

  async function moveSectionDown(idx: number) {
    if (idx === sections.length - 1) return;
    await moveSectionUp(idx + 1);
  }

  // ─── Fields ───────────────────────────────────────────────────
  async function addField(sectionId: string) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    const { data } = await supabase.from('form_fields').insert({
      section_id: sectionId, field_type: 'text', label: 'New Field',
      placeholder: '', helper_text: '', required: false, options: [], order_index: sec.fields.length,
    }).select().single();
    if (data) setSections(prev => prev.map(s => s.id === sectionId ? { ...s, fields: [...s.fields, data] } : s));
  }

  async function updateField(sectionId: string, fieldId: string, patch: Partial<FormField>) {
    const safePatch = {
      ...patch,
      placeholder: patch.placeholder ?? '',
      helper_text: patch.helper_text ?? '',
      ...(patch.options !== undefined ? { options: patch.options ?? [] } : {}),
    };
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, fields: s.fields.map(f => f.id === fieldId ? { ...f, ...safePatch } : f) } : s
    ));
  }

  async function saveField(sectionId: string, fieldId: string) {
    const field = sections.find(s => s.id === sectionId)?.fields.find(f => f.id === fieldId);
    if (!field) return;
    await supabase.from('form_fields').update({
      field_type: field.field_type, label: field.label, placeholder: field.placeholder,
      helper_text: field.helper_text, required: field.required, options: field.options,
      updated_at: new Date().toISOString(),
    }).eq('id', fieldId);
    showToast('Field saved');
  }

  async function deleteField(sectionId: string, fieldId: string) {
    if (!confirm('Delete this field?')) return;
    await supabase.from('form_fields').delete().eq('id', fieldId);
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, fields: s.fields.filter(f => f.id !== fieldId) } : s
    ));
    showToast('Field deleted');
  }

  async function moveFieldUp(sectionId: string, idx: number) {
    if (idx === 0) return;
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const fields = [...s.fields];
      [fields[idx - 1], fields[idx]] = [fields[idx], fields[idx - 1]];
      fields.forEach((f, i) => { f.order_index = i; });
      Promise.all(fields.map(f => supabase.from('form_fields').update({ order_index: f.order_index }).eq('id', f.id)));
      return { ...s, fields };
    }));
  }

  async function moveFieldDown(sectionId: string, idx: number) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec || idx === sec.fields.length - 1) return;
    await moveFieldUp(sectionId, idx + 1);
  }

  // ─── Backup / Restore ─────────────────────────────────────────
  function backup() {
    const blob = new Blob([JSON.stringify({ config, sections }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learning-walk-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup downloaded');
  }

  async function restore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !config) return;
    const parsed = JSON.parse(await file.text());
    if (!parsed.config || !parsed.sections) { showToast('Invalid backup file'); return; }
    if (!confirm('This will replace the current form with the backup. Continue?')) return;
    await supabase.from('form_config').update({ title: parsed.config.title, description: parsed.config.description, theme_color: parsed.config.theme_color, updated_at: new Date().toISOString() }).eq('id', config.id);
    await supabase.from('form_sections').delete().eq('form_id', config.id);
    for (const sec of parsed.sections) {
      const { data: newSec } = await supabase.from('form_sections').insert({ form_id: config.id, title: sec.title, description: sec.description, order_index: sec.order_index }).select().single();
      if (newSec && sec.fields?.length) {
        await supabase.from('form_fields').insert(sec.fields.map((f: FormField) => ({ section_id: newSec.id, field_type: f.field_type, label: f.label, placeholder: f.placeholder, helper_text: f.helper_text, required: f.required, options: f.options, order_index: f.order_index })));
      }
    }
    await loadAll();
    showToast('Backup restored successfully');
    e.target.value = '';
  }

  async function deleteAllSubmissions() {
    if (!config) return;
    if (!confirm('Delete ALL submissions permanently? This cannot be undone.')) return;
    if (!confirm('Final confirmation: all submission data will be lost forever.')) return;
    await supabase.from('form_submissions').delete().eq('form_id', config.id);
    showToast('All submissions deleted');
  }

  // ─── Admins ───────────────────────────────────────────────────
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'admin' | 'super_admin'>('admin');
  const [addingAdmin, setAddingAdmin] = useState(false);

  async function addAdmin() {
    if (!newAdminEmail) return;
    setAddingAdmin(true);
    const { data, error } = await supabase.from('admin_users').insert({ email: newAdminEmail, role: newAdminRole }).select().single();
    if (error) showToast('Error: ' + error.message);
    else if (data) { setAdmins(prev => [...prev, data]); setNewAdminEmail(''); showToast('Admin added'); }
    setAddingAdmin(false);
  }

  async function deleteAdmin(id: string) {
    if (!confirm('Remove this admin?')) return;
    await supabase.from('admin_users').delete().eq('id', id);
    setAdmins(prev => prev.filter(a => a.id !== id));
    showToast('Admin removed');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%)' }}>
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const TABS = [
    { id: 'form-builder', label: 'Form Builder', icon: LayoutList },
    { id: 'submissions', label: 'Submissions', icon: FileText },
    { id: 'admins', label: 'Manage Admins', icon: Users },
    { id: 'settings', label: 'Settings & Backup', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(160deg, #dbeafe 0%, #bfdbfe 50%, #c7d2fe 100%)' }}>
      {/* Sidebar */}
      <aside className="w-64 min-h-screen bg-gray-900 text-white flex flex-col fixed top-0 left-0 z-10">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">Super Admin</p>
              <p className="text-xs text-gray-400 truncate max-w-36">superadmin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {TABS.map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id as Tab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${tab === item.id ? 'bg-amber-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-1">
          <button onClick={() => onNavigate('admin')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Admin Dashboard
          </button>
          <button onClick={() => onNavigate('form')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
            <Eye className="w-4 h-4" /> View Form
          </button>
          <button onClick={() => { signOut(); onNavigate('login'); }} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-64 flex-1 p-8 min-h-screen">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{TABS.find(t => t.id === tab)?.label}</h1>
          <p className="text-sm text-gray-400 mt-0.5">Learning Walk 2026 — Super Admin Panel</p>
        </div>

        {/* ── FORM BUILDER ── */}
        {tab === 'form-builder' && config && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" /> Form Settings
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Form Title</label>
                  <input value={config.title} onChange={e => setConfig(c => c ? { ...c, title: e.target.value } : c)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Theme Color</label>
                  <div className="flex gap-2">
                    <input type="color" value={config.theme_color} onChange={e => setConfig(c => c ? { ...c, theme_color: e.target.value } : c)}
                      className="w-12 h-11 rounded-xl border border-gray-200 cursor-pointer p-1" />
                    <input value={config.theme_color} onChange={e => setConfig(c => c ? { ...c, theme_color: e.target.value } : c)}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
                  <textarea value={config.description} onChange={e => setConfig(c => c ? { ...c, description: e.target.value } : c)}
                    rows={2} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <button onClick={() => setConfig(c => c ? { ...c, is_active: !c.is_active } : c)} className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
                    {config.is_active ? <ToggleRight className="w-6 h-6 text-emerald-500" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                    Form is {config.is_active ? 'open — accepting responses' : 'closed'}
                  </button>
                </div>
              </div>
              <div className="flex justify-end mt-5">
                <button onClick={saveConfig} disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60">
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>

            {sections.map((sec, sIdx) => (
              <SectionEditor
                key={sec.id}
                section={sec}
                sectionIndex={sIdx}
                totalSections={sections.length}
                onUpdate={p => updateSection(sec.id, p)}
                onSave={() => saveSection(sec.id)}
                onDelete={() => deleteSection(sec.id)}
                onMoveUp={() => moveSectionUp(sIdx)}
                onMoveDown={() => moveSectionDown(sIdx)}
                onAddField={() => addField(sec.id)}
                onUpdateField={(fId, p) => updateField(sec.id, fId, p)}
                onSaveField={fId => saveField(sec.id, fId)}
                onDeleteField={fId => deleteField(sec.id, fId)}
                onMoveFieldUp={fIdx => moveFieldUp(sec.id, fIdx)}
                onMoveFieldDown={fIdx => moveFieldDown(sec.id, fIdx)}
              />
            ))}

            <button onClick={addSection}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-600 transition-colors text-sm font-medium">
              <Plus className="w-4 h-4" /> Add Section
            </button>
          </div>
        )}

        {/* ── SUBMISSIONS ── */}
        {tab === 'submissions' && config && (
          <SubmissionsManager formId={config.id} onToast={showToast} />
        )}

        {/* ── ADMINS ── */}
        {tab === 'admins' && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Add Admin User</h2>
              <div className="flex gap-3">
                <input value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="email@example.com" type="email"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                <select value={newAdminRole} onChange={e => setNewAdminRole(e.target.value as 'admin' | 'super_admin')}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <button onClick={addAdmin} disabled={addingAdmin || !newAdminEmail}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">User must create a Supabase account with this email to gain access.</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {admins.length === 0 ? (
                <div className="p-10 text-center"><Users className="w-10 h-10 text-gray-200 mx-auto mb-2" /><p className="text-gray-400 text-sm">No admins configured</p></div>
              ) : (
                admins.map(a => (
                  <div key={a.id} className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-0">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-sm">
                      {a.email[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.email}</p>
                      <p className="text-xs text-gray-400">Added {new Date(a.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${a.role === 'super_admin' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {a.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                    </span>
                    <button onClick={() => deleteAdmin(a.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === 'settings' && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2"><Download className="w-4 h-4 text-gray-400" /> Backup Form</h2>
              <p className="text-sm text-gray-500 mb-4">Download a JSON backup of your entire form structure (sections, fields, options).</p>
              <button onClick={backup} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
                <Download className="w-4 h-4" /> Download Backup
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2"><Upload className="w-4 h-4 text-gray-400" /> Restore from Backup</h2>
              <p className="text-sm text-gray-500 mb-4">Upload a backup file to restore your form. This overwrites the current form structure.</p>
              <label className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors cursor-pointer w-fit">
                <Upload className="w-4 h-4" /> Choose Backup File
                <input type="file" accept=".json" onChange={restore} className="hidden" />
              </label>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Database className="w-4 h-4 text-gray-400" /> Form Statistics</h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-3xl font-bold text-gray-900">{sections.length}</p>
                  <p className="text-xs text-gray-400 mt-1 font-medium">Sections</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-3xl font-bold text-gray-900">{sections.reduce((a, s) => a + s.fields.length, 0)}</p>
                  <p className="text-xs text-gray-400 mt-1 font-medium">Fields</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-3xl font-bold text-gray-900">{admins.length}</p>
                  <p className="text-xs text-gray-400 mt-1 font-medium">Admins</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-red-200 p-6">
              <h2 className="font-semibold text-red-700 mb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Danger Zone</h2>
              <p className="text-sm text-gray-500 mb-4">Permanently delete all form submissions. This action cannot be undone.</p>
              <button onClick={deleteAllSubmissions} className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors">
                <Trash2 className="w-4 h-4" /> Delete All Submissions
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 z-50 animate-slide-up">
          <Check className="w-4 h-4 text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  );
}

// ─── Submissions Manager ──────────────────────────────────────────────────────

function SubmissionsManager({ formId, onToast }: { formId: string; onToast: (msg: string) => void }) {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, SubmissionAnswer[]>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('form_submissions').select('*').eq('form_id', formId).order('submitted_at', { ascending: false });
    setSubmissions(data || []);
    setLoading(false);
  }

  async function loadAnswers(id: string) {
    if (answers[id]) return;
    const { data } = await supabase.from('submission_answers').select('*').eq('submission_id', id).order('created_at');
    setAnswers(prev => ({ ...prev, [id]: data || [] }));
  }

  async function toggle(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    await loadAnswers(id);
  }

  async function updateStatus(id: string, status: SubmissionStatus) {
    setUpdatingId(id);
    await supabase.from('form_submissions').update({ status }).eq('id', id);
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    setUpdatingId(null);
    onToast('Status updated');
  }

  async function deleteSubmission(id: string) {
    if (!confirm('Delete this submission permanently?')) return;
    await supabase.from('form_submissions').delete().eq('id', id);
    setSubmissions(prev => prev.filter(s => s.id !== id));
    if (expandedId === id) setExpandedId(null);
    onToast('Submission deleted');
  }

  if (loading) {
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (submissions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center max-w-2xl">
        <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400 font-medium">No submissions yet</p>
      </div>
    );
  }

  const statusColors: Record<SubmissionStatus, string> = {
    new: 'bg-yellow-100 text-yellow-700',
    reviewed: 'bg-blue-100 text-blue-700',
    resolved: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="space-y-3 max-w-4xl">
      <p className="text-sm text-gray-500">{submissions.length} total submission{submissions.length !== 1 ? 's' : ''}</p>
      {submissions.map(sub => {
        const teacher = sub.submitter_name.split(' — ')[0] || sub.submitter_name;
        const cls = sub.submitter_name.split(' — ')[1] || '';
        return (
          <div key={sub.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 text-sm">{teacher}</p>
                  {cls && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg">{cls}</span>}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{formatDT(sub.submitted_at)}</p>
              </div>

              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusColors[sub.status]}`}>{sub.status}</span>

              {/* Status change */}
              <div className="flex gap-1">
                {(['new', 'reviewed', 'resolved'] as SubmissionStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => updateStatus(sub.id, s)}
                    disabled={updatingId === sub.id || sub.status === s}
                    className={`px-2 py-1 rounded-lg text-xs font-medium capitalize transition-colors disabled:opacity-40 ${sub.status === s ? statusColors[s] : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <button onClick={() => toggle(sub.id)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
                <ChevronRight className={`w-4 h-4 transition-transform ${expandedId === sub.id ? 'rotate-90' : ''}`} />
              </button>
              <button onClick={() => deleteSubmission(sub.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {expandedId === sub.id && (
              <div className="border-t border-gray-100 bg-gray-50 p-5">
                {!answers[sub.id] ? (
                  <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {answers[sub.id].filter(a => a.answer?.trim()).map(a => (
                      <div key={a.id} className="bg-white rounded-xl p-3.5 border border-gray-100">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{a.field_label}</p>
                        <p className="text-sm text-gray-800">{a.answer}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Section Editor ───────────────────────────────────────────────────────────

interface SectionEditorProps {
  section: FormSection & { fields: FormField[] };
  sectionIndex: number; totalSections: number;
  onUpdate: (p: Partial<FormSection>) => void; onSave: () => void; onDelete: () => void;
  onMoveUp: () => void; onMoveDown: () => void; onAddField: () => void;
  onUpdateField: (id: string, p: Partial<FormField>) => void; onSaveField: (id: string) => void;
  onDeleteField: (id: string) => void; onMoveFieldUp: (idx: number) => void; onMoveFieldDown: (idx: number) => void;
}

function SectionEditor({ section, sectionIndex, totalSections, onUpdate, onSave, onDelete, onMoveUp, onMoveDown, onAddField, onUpdateField, onSaveField, onDeleteField, onMoveFieldUp, onMoveFieldDown }: SectionEditorProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-5 py-4 bg-gray-50 border-b border-gray-100">
        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex flex-col gap-2">
              <input value={section.title} onChange={e => onUpdate({ title: e.target.value })} placeholder="Section heading"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400" autoFocus />
              <input value={section.description} onChange={e => onUpdate({ description: e.target.value })} placeholder="Subheading (optional)"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          ) : (
            <div>
              <p className="font-bold text-gray-900">{section.title || 'Untitled Section'}</p>
              {section.description && <p className="text-xs text-gray-400 mt-0.5">{section.description}</p>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs text-gray-400 mr-2">{section.fields.length} field{section.fields.length !== 1 ? 's' : ''}</span>
          <button onClick={onMoveUp} disabled={sectionIndex === 0} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
          <button onClick={onMoveDown} disabled={sectionIndex === totalSections - 1} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
          {editing ? (
            <>
              <button onClick={() => { onSave(); setEditing(false); }} className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-600"><Check className="w-4 h-4" /></button>
              <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400"><X className="w-4 h-4" /></button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"><Edit2 className="w-4 h-4" /></button>
          )}
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-100 text-red-400"><Trash2 className="w-4 h-4" /></button>
          <button onClick={() => setCollapsed(v => !v)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400">
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-2">
          {section.fields.map((f, fIdx) => (
            <FieldEditor key={f.id} field={f} fieldIndex={fIdx} totalFields={section.fields.length}
              onUpdate={p => onUpdateField(f.id, p)} onSave={() => onSaveField(f.id)}
              onDelete={() => onDeleteField(f.id)} onMoveUp={() => onMoveFieldUp(fIdx)} onMoveDown={() => onMoveFieldDown(fIdx)} />
          ))}
          <button onClick={onAddField}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-gray-200 text-gray-400 hover:border-amber-400 hover:text-amber-600 transition-colors text-sm">
            <Plus className="w-4 h-4" /> Add Field
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Field Editor ─────────────────────────────────────────────────────────────

interface FieldEditorProps {
  field: FormField; fieldIndex: number; totalFields: number;
  onUpdate: (p: Partial<FormField>) => void; onSave: () => void; onDelete: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
}

function FieldEditor({ field, fieldIndex, totalFields, onUpdate, onSave, onDelete, onMoveUp, onMoveDown }: FieldEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [optionInput, setOptionInput] = useState('');
  const hasOptions = ['radio', 'checkbox', 'select'].includes(field.field_type);

  function addOption() {
    if (!optionInput.trim()) return;
    onUpdate({ options: [...field.options, optionInput.trim()] });
    setOptionInput('');
  }

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
        <GripVertical className="w-4 h-4 text-gray-200 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{field.label || 'Unnamed Field'}</p>
          <p className="text-xs text-gray-400">
            {FIELD_TYPES.find(t => t.value === field.field_type)?.label}
            {field.required && <span className="text-red-400 ml-1.5">· Required</span>}
            {field.options.length > 0 && <span className="text-gray-300 ml-1.5">· {field.options.length} options</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onMoveUp} disabled={fieldIndex === 0} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
          <button onClick={onMoveDown} disabled={fieldIndex === totalFields - 1} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
          <button onClick={() => setExpanded(v => !v)} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500"><Edit2 className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Label *</label>
              <input value={field.label} onChange={e => onUpdate({ label: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Field Type</label>
              <select value={field.field_type} onChange={e => onUpdate({ field_type: e.target.value as FieldType, options: [] })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Placeholder</label>
              <input value={field.placeholder} onChange={e => onUpdate({ placeholder: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Helper Text</label>
              <input value={field.helper_text} onChange={e => onUpdate({ helper_text: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={field.required} onChange={e => onUpdate({ required: e.target.checked })} className="w-4 h-4 accent-amber-500" />
            <span className="text-sm text-gray-700 font-medium">Required field</span>
          </label>

          {hasOptions && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Options</label>
              <div className="space-y-1.5 mb-2 max-h-48 overflow-y-auto">
                {field.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200">
                    <span className="flex-1 text-sm text-gray-700">{opt}</span>
                    <button onClick={() => onUpdate({ options: field.options.filter((_, j) => j !== i) })} className="text-gray-300 hover:text-red-500 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {field.options.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No options yet</p>}
              </div>
              <div className="flex gap-2">
                <input value={optionInput} onChange={e => setOptionInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                  placeholder="Type option and press Enter..."
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
                <button onClick={addOption} className="px-3 py-2 bg-amber-500 text-white rounded-xl text-sm hover:bg-amber-600 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setExpanded(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
            <button onClick={() => { onSave(); setExpanded(false); }}
              className="flex items-center gap-1.5 px-5 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors">
              <Check className="w-3.5 h-3.5" /> Save Field
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
