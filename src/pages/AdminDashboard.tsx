import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { FormSubmission, SubmissionAnswer, SubmissionStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  Eye, Shield, Search, ChevronDown, ChevronRight,
  FileText, CheckCircle, Clock, Star, Users, BarChart2, RefreshCw
} from 'lucide-react';interface Props {
  onNavigate: (page: 'form' | 'login' | 'admin' | 'super-admin') => void;
}

type DateFilter = 'all' | 'today' | 'month' | 'year';

function extractTeacher(name: string) { return name.split(' — ')[0] || name || 'Unknown'; }
function extractClass(name: string) { return name.split(' — ')[1] || ''; }

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminDashboard({ onNavigate }: Props) {
  const { role } = useAuth();
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [search, setSearch] = useState('');
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<Record<string, SubmissionAnswer[]>>({});
  const [loadingAnswers, setLoadingAnswers] = useState<Set<string>>(new Set());
  const [updatingStatus, setUpdatingStatus] = useState<Set<string>>(new Set());

  useEffect(() => { loadSubmissions(); }, []);

  async function loadSubmissions() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('form_submissions')
        .select('*')
        .order('submitted_at', { ascending: false });
      setSubmissions(data || []);
    } finally {
      setLoading(false);
    }
  }

  async function loadAnswers(subId: string) {
    if (answers[subId] || loadingAnswers.has(subId)) return;
    setLoadingAnswers(prev => new Set(prev).add(subId));
    const { data } = await supabase
      .from('submission_answers')
      .select('*')
      .eq('submission_id', subId)
      .order('created_at');
    setAnswers(prev => ({ ...prev, [subId]: data || [] }));
    setLoadingAnswers(prev => { const s = new Set(prev); s.delete(subId); return s; });
  }

  function toggleTeacher(name: string) {
    setExpandedTeachers(prev => {
      const s = new Set(prev);
      s.has(name) ? s.delete(name) : s.add(name);
      return s;
    });
  }

  function toggleSub(id: string) {
    setExpandedSubs(prev => {
      const s = new Set(prev);
      if (s.has(id)) { s.delete(id); } else { s.add(id); loadAnswers(id); }
      return s;
    });
  }

  async function updateStatus(id: string, status: SubmissionStatus) {
    setUpdatingStatus(prev => new Set(prev).add(id));
    await supabase.from('form_submissions').update({ status }).eq('id', id);
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    setUpdatingStatus(prev => { const s = new Set(prev); s.delete(id); return s; });
  }

  function applyDateFilter(list: FormSubmission[]) {
    if (dateFilter === 'all') return list;
    const now = new Date();
    return list.filter(s => {
      const d = new Date(s.submitted_at);
      if (dateFilter === 'today') return d.toDateString() === now.toDateString();
      if (dateFilter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (dateFilter === 'year') return d.getFullYear() === now.getFullYear();
      return true;
    });
  }

  const filtered = useMemo(() => {
    let list = applyDateFilter(submissions);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.submitter_name.toLowerCase().includes(q));
    }
    return list;
  }, [submissions, dateFilter, search]);

  const stats = useMemo(() => ({
    total: filtered.length,
    grades: new Set(filtered.map(s => extractClass(s.submitter_name)).filter(Boolean)).size,
  }), [filtered]);

  const grouped = useMemo(() => {
    const map = new Map<string, FormSubmission[]>();
    for (const s of filtered) {
      const teacher = extractTeacher(s.submitter_name);
      if (!map.has(teacher)) map.set(teacher, []);
      map.get(teacher)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  // Auto-expand all groups on first data load
  useEffect(() => {
    if (grouped.length > 0) {
      setExpandedTeachers(new Set(grouped.map(([t]) => t)));
    }
  }, [submissions]);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #dbeafe 0%, #bfdbfe 50%, #c7d2fe 100%)' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #1e40af, #0891b2)' }}>
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-base leading-tight">Admin Dashboard</h1>
              <p className="text-xs text-gray-400">Learning Walk 2026 — Morning</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={loadSubmissions} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => onNavigate('form')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
              <Eye className="w-4 h-4" /> <span className="hidden sm:inline">View Form</span>
            </button>
            {role === 'super_admin' && (
              <button onClick={() => onNavigate('super-admin')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-amber-600 hover:bg-amber-50 transition-colors">
                <Shield className="w-4 h-4" /> <span className="hidden sm:inline">Super Admin</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[
            { label: 'Total', value: stats.total, icon: FileText, bg: 'bg-blue-50', fg: 'text-blue-600', bar: 'bg-blue-500' },
            { label: 'Grade', value: stats.grades, icon: Users, bg: 'bg-emerald-50', fg: 'text-emerald-600', bar: 'bg-emerald-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg}`}>
                  <s.icon className={`w-4 h-4 ${s.fg}`} />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{s.value}</p>
              <div className="w-full bg-gray-100 rounded-full h-1">
                <div className={`h-1 rounded-full ${s.bar}`} style={{ width: s.label === 'Total' ? '100%' : `${stats.total > 0 ? Math.min((s.value / stats.total) * 100, 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-3 items-center">
          <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
            {([
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'month', label: 'This Month' },
              { id: 'year', label: 'This Year' },
            ] as { id: DateFilter; label: string }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setDateFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${dateFilter === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by teacher name..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
            />
          </div>

          <span className="text-sm text-gray-400 whitespace-nowrap">
            {filtered.length} submission{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Teacher groups */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading submissions...</p>
          </div>
        ) : grouped.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <Users className="w-14 h-14 text-gray-200 mx-auto mb-4" />
            <p className="font-semibold text-gray-400 text-lg">No submissions found</p>
            <p className="text-gray-300 text-sm mt-1">Submissions appear here when teachers fill the form</p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([teacher, subs]) => (
              <TeacherGroup
                key={teacher}
                teacher={teacher}
                submissions={subs}
                expanded={expandedTeachers.has(teacher)}
                expandedSubs={expandedSubs}
                answers={answers}
                loadingAnswers={loadingAnswers}
                updatingStatus={updatingStatus}
                onToggle={() => toggleTeacher(teacher)}
                onToggleSub={toggleSub}
                onUpdateStatus={updateStatus}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Components ───────────────────────────────────────────────────────────────

interface TeacherGroupProps {
  teacher: string;
  submissions: FormSubmission[];
  expanded: boolean;
  expandedSubs: Set<string>;
  answers: Record<string, SubmissionAnswer[]>;
  loadingAnswers: Set<string>;
  updatingStatus: Set<string>;
  onToggle: () => void;
  onToggleSub: (id: string) => void;
  onUpdateStatus: (id: string, status: SubmissionStatus) => void;
}

function TeacherGroup({ teacher, submissions, expanded, expandedSubs, answers, loadingAnswers, updatingStatus, onToggle, onToggleSub, onUpdateStatus }: TeacherGroupProps) {
  const newCount = submissions.filter(s => s.status === 'new').length;
  const initials = teacher.split(' ').filter(w => w.match(/[A-Za-z]/)).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const colors = ['from-blue-500 to-blue-700', 'from-teal-500 to-teal-700', 'from-cyan-500 to-cyan-700', 'from-sky-500 to-sky-700', 'from-indigo-500 to-blue-600'];
  const colorIdx = teacher.charCodeAt(0) % colors.length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Group header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-6 py-5 hover:bg-gray-50 transition-colors"
      >
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colors[colorIdx]} flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-sm`}>
          {initials}
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 text-base">{teacher}</p>
            {newCount > 0 && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">
                {newCount} new
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
            {' · '}Last: {formatDate(submissions[0].submitted_at)}
          </p>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Submissions */}
      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {submissions.map((sub) => (
            <SubmissionRow
              key={sub.id}
              submission={sub}
              expanded={expandedSubs.has(sub.id)}
              answers={answers[sub.id]}
              loadingAnswers={loadingAnswers.has(sub.id)}
              updatingStatus={updatingStatus.has(sub.id)}
              onToggle={() => onToggleSub(sub.id)}
              onUpdateStatus={(status) => onUpdateStatus(sub.id, status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SubmissionRowProps {
  submission: FormSubmission;
  expanded: boolean;
  answers?: SubmissionAnswer[];
  loadingAnswers: boolean;
  updatingStatus: boolean;
  onToggle: () => void;
  onUpdateStatus: (status: SubmissionStatus) => void;
}

function SubmissionRow({ submission, expanded, answers, loadingAnswers, updatingStatus, onToggle, onUpdateStatus }: SubmissionRowProps) {
  const classVal = extractClass(submission.submitter_name);

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex-1 flex items-center gap-3 flex-wrap">
          {classVal && (
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg">{classVal}</span>
          )}
          <span className="text-sm text-gray-500">{formatDateTime(submission.submitted_at)}</span>
        </div>
        <StatusBadge status={submission.status} />
        <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="mx-4 mb-4 bg-slate-50 rounded-2xl p-5 border border-slate-100">
          {/* Status controls */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Change Status:</span>
            {(['new', 'reviewed', 'resolved'] as SubmissionStatus[]).map(s => (
              <button
                key={s}
                onClick={() => onUpdateStatus(s)}
                disabled={updatingStatus}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all disabled:opacity-50 ${
                  submission.status === s ? statusActiveCss(s) : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {s}
              </button>
            ))}
            {updatingStatus && <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
          </div>

          {/* Answers grid */}
          {loadingAnswers ? (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(answers || []).filter(a => a.answer?.trim()).map(a => (
                <div key={a.id} className="bg-white rounded-xl p-3.5 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{a.field_label}</p>
                  <p className="text-sm text-gray-800 leading-relaxed">{a.answer}</p>
                </div>
              ))}
              {!(answers || []).filter(a => a.answer?.trim()).length && (
                <p className="text-sm text-gray-400 col-span-2 text-center py-2">No answers recorded</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const map = {
    new: 'bg-yellow-100 text-yellow-700',
    reviewed: 'bg-blue-100 text-blue-700',
    resolved: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize flex-shrink-0 ${map[status]}`}>
      {status}
    </span>
  );
}

function statusActiveCss(s: SubmissionStatus) {
  const map = {
    new: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    reviewed: 'bg-blue-100 text-blue-700 border border-blue-200',
    resolved: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  };
  return map[s];
}
