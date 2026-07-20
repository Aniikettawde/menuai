// src/components/whatsapp/CampaignManager.tsx
'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Megaphone,
  Plus,
  X,
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  ChevronLeft,
  PlayCircle,
  Eye,
  AlertTriangle,
} from 'lucide-react';

const C = {
  pageBg: '#F0F2F5',
  panelBg: '#FFFFFF',
  headerBg: '#008069',
  accentBright: '#00A884',
  accentSoft: '#D9FDD3',
  border: '#E9EDEF',
  textPrimary: '#111B21',
  textSecondary: '#54656F',
  textMuted: '#8696A0',
  warnBg: '#FFF8DB',
  warnText: '#8A6D00',
  errBg: '#FDECEC',
  errText: '#B42318',
  draftBg: '#EEF0F2',
  draftText: '#54656F',
};

type CampaignStatus = 'queued' | 'sending' | 'completed' | 'failed' | 'insufficient_credits';

type Campaign = {
  id: string;
  restaurant_id: string | null;
  name: string;
  template_name: string;
  template_language: string;
  header_variable: string | null;
  body_variables: string[];
  audience_filter: { restaurantName?: string; sinceDays?: number };
  status: CampaignStatus;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  estimated_cost: number;
  actual_cost: number;
  created_at: string;
  updated_at: string;
};

type Recipient = {
  id: string;
  wa_id: string;
  name: string | null;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | null;
  error_message: string | null;
  sent_at: string | null;
};

type Template = {
  name: string;
  language: string;
  category: string;
  bodyText: string;
  placeholderCount: number;
};

type RestaurantOption = { name: string; count: number };

function fillPreview(bodyText: string, params: string[]) {
  let out = bodyText;
  params.forEach((p, i) => {
    out = out.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), p || `{{${i + 1}}}`);
  });
  return out;
}

const STATUS_MAP: Record<CampaignStatus, { bg: string; text: string; label: string }> = {
  queued: { bg: C.draftBg, text: C.draftText, label: 'Queued' },
  sending: { bg: C.warnBg, text: C.warnText, label: 'Sending' },
  completed: { bg: C.accentSoft, text: '#0B3D2E', label: 'Completed' },
  failed: { bg: C.errBg, text: C.errText, label: 'Failed' },
  insufficient_credits: { bg: C.errBg, text: C.errText, label: 'Out of credits' },
};

function StatusBadge({ status }: { status: CampaignStatus }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.queued; // fallback guards against any future/unknown status value
  return (
    <span
      className="text-[11px] font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1"
      style={{ background: s.bg, color: s.text }}
    >
      {status === 'sending' && <Loader2 size={11} className="animate-spin" />}
      {status === 'insufficient_credits' && <AlertTriangle size={11} />}
      {s.label}
    </span>
  );
}

function ProgressBar({ sent, failed, total }: { sent: number; failed: number; total: number }) {
  const donePct = total > 0 ? Math.min(((sent + failed) / total) * 100, 100) : 0;
  const failShare = sent + failed > 0 ? failed / (sent + failed) : 0;
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
      <div className="h-full flex" style={{ width: `${donePct}%` }}>
        <div className="h-full" style={{ width: `${(1 - failShare) * 100}%`, background: C.accentBright }} />
        <div className="h-full" style={{ width: `${failShare * 100}%`, background: C.errText }} />
      </div>
    </div>
  );
}

export default function CampaignManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<{ campaign: Campaign; recipients: Recipient[] } | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const activeSendRef = useRef<Set<string>>(new Set());

  const loadCampaigns = useCallback(async () => {
    const res = await fetch('/api/whatsapp/campaigns');
    const data = await res.json();
    if (data.campaigns) setCampaigns(data.campaigns);
    setLoading(false);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/whatsapp/campaigns/${id}`);
    const data = await res.json();
    if (data.campaign) setSelectedDetail({ campaign: data.campaign, recipients: data.recipients || [] });
  }, []);

  useEffect(() => {
    loadCampaigns();
    const interval = setInterval(loadCampaigns, 5000);
    return () => clearInterval(interval);
  }, [loadCampaigns]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const driveSend = useCallback(
    async (id: string) => {
      if (activeSendRef.current.has(id)) return;
      activeSendRef.current.add(id);
      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const res = await fetch(`/api/whatsapp/campaigns/${id}/send`, { method: 'POST' });
          const data = await res.json();
          if (!res.ok) break;
          if (data.campaign) {
            setSelectedDetail((prev) => (prev && prev.campaign.id === id ? { ...prev, campaign: data.campaign } : prev));
            setCampaigns((prev) => prev.map((c) => (c.id === id ? data.campaign : c)));
          }
          if (data.done || data.campaign?.status === 'insufficient_credits' || data.campaign?.status === 'failed') break;
          await new Promise((r) => setTimeout(r, 800));
        }
      } finally {
        activeSendRef.current.delete(id);
        loadDetail(id);
        loadCampaigns();
      }
    },
    [loadDetail, loadCampaigns]
  );

  const selectedContent = selectedDetail?.campaign.id === selectedId ? selectedDetail : null;

  if (selectedId) {
    return (
      <CampaignDetail
        detail={selectedContent}
        onBack={() => {
          setSelectedId(null);
          setSelectedDetail(null);
        }}
        onStartSend={() => driveSend(selectedId)}
        onDeleted={() => {
          setSelectedId(null);
          setSelectedDetail(null);
          loadCampaigns();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full w-full" style={{ background: C.pageBg }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: C.headerBg }}>
        <div>
          <h1 className="font-semibold text-[17px] text-white">Campaigns</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Dinezy-wide broadcasts to every logged-in customer, across every restaurant
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white transition-transform hover:scale-105"
          style={{ background: 'rgba(255,255,255,0.16)' }}
        >
          <Plus size={16} /> New campaign
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-40" style={{ color: C.textMuted }}>
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#E9EDEF' }}>
              <Megaphone size={26} color={C.textMuted} />
            </div>
            <div>
              <p className="font-medium text-[15px]" style={{ color: C.textPrimary }}>
                No campaigns yet
              </p>
              <p className="text-sm mt-1" style={{ color: C.textMuted }}>
                Create one to message a segment of your Dinezy-wide contacts with an approved template.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 max-w-3xl">
            {campaigns.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="text-left rounded-xl border p-4 transition-shadow hover:shadow-md"
                style={{ background: C.panelBg, borderColor: C.border }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-[15px] truncate" style={{ color: C.textPrimary }}>
                      {c.name}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: C.textMuted }}>
                      Template: {c.template_name} · {new Date(c.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <div className="mt-3">
                  <ProgressBar sent={c.sent_count} failed={c.failed_count} total={c.total_recipients} />
                  <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap" style={{ color: C.textSecondary }}>
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {c.total_recipients}
                    </span>
                    <span className="flex items-center gap-1" style={{ color: C.accentBright }}>
                      <CheckCircle2 size={12} /> {c.sent_count} sent
                    </span>
                    {c.delivered_count > 0 && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 size={12} /> {c.delivered_count} delivered
                      </span>
                    )}
                    {c.read_count > 0 && (
                      <span className="flex items-center gap-1">
                        <Eye size={12} /> {c.read_count} read
                      </span>
                    )}
                    {c.failed_count > 0 && (
                      <span className="flex items-center gap-1" style={{ color: C.errText }}>
                        <XCircle size={12} /> {c.failed_count} failed
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onCreated={(campaign) => {
            setShowCreate(false);
            loadCampaigns();
            setSelectedId(campaign.id);
          }}
        />
      )}
    </div>
  );
}

// ─── Detail view ────────────────────────────────────────────────────────────

function CampaignDetail({
  detail,
  onBack,
  onStartSend,
  onDeleted,
}: {
  detail: { campaign: Campaign; recipients: Recipient[] } | null;
  onBack: () => void;
  onStartSend: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  if (!detail) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: C.pageBg, color: C.textMuted }}>
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  const { campaign, recipients } = detail;
  const pending = campaign.total_recipients - campaign.sent_count - campaign.failed_count;
  const canSend = campaign.status === 'queued' || campaign.status === 'sending' || campaign.status === 'insufficient_credits';

  async function handleDelete() {
    if (!confirm(`Delete "${campaign.name}"? This can't be undone.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/whatsapp/campaigns/${campaign.id}`, { method: 'DELETE' });
      onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col h-full w-full" style={{ background: C.pageBg }}>
      <div className="px-3 py-2.5 flex items-center gap-2" style={{ background: C.headerBg }}>
        <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10" aria-label="Back to campaigns">
          <ChevronLeft size={20} color="#fff" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[15px] text-white truncate">{campaign.name}</div>
          <div className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {campaign.template_name} ({campaign.template_language})
          </div>
        </div>
        <button onClick={handleDelete} disabled={deleting} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 disabled:opacity-50" aria-label="Delete campaign">
          <Trash2 size={17} color="#fff" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl">
        <div className="rounded-xl border p-4" style={{ background: C.panelBg, borderColor: C.border }}>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <StatusBadge status={campaign.status} />
            {canSend && (
              <button
                onClick={onStartSend}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-transform hover:scale-105"
                style={{ background: C.accentBright }}
              >
                <PlayCircle size={14} />
                {campaign.status === 'queued' ? 'Start sending' : 'Resume sending'}
              </button>
            )}
          </div>

          {campaign.status === 'insufficient_credits' && (
            <div className="flex items-start gap-2 text-xs mb-3 px-3 py-2.5 rounded-lg font-medium" style={{ background: C.warnBg, color: C.warnText }}>
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              This restaurant ran out of WhatsApp credit mid-send. Recharge, then hit resume to finish the remaining recipients.
            </div>
          )}

          <ProgressBar sent={campaign.sent_count} failed={campaign.failed_count} total={campaign.total_recipients} />
          <div className="grid grid-cols-5 gap-2 mt-3 text-center">
            <Stat label="Total" value={campaign.total_recipients} color={C.textPrimary} />
            <Stat label="Sent" value={campaign.sent_count} color={C.accentBright} />
            <Stat label="Read" value={campaign.read_count} color={C.textSecondary} />
            <Stat label="Failed" value={campaign.failed_count} color={C.errText} />
            <Stat label="Pending" value={Math.max(pending, 0)} color={C.textSecondary} />
          </div>

          {campaign.restaurant_id && (
            <div className="text-[11px] mt-3" style={{ color: C.textMuted }}>
              Billed: ₹{campaign.actual_cost?.toFixed(2) ?? '0.00'} of ₹{campaign.estimated_cost?.toFixed(2) ?? '0.00'} estimated
            </div>
          )}
        </div>

        <div className="rounded-xl border overflow-hidden" style={{ background: C.panelBg, borderColor: C.border }}>
          <div className="px-4 py-2.5 border-b text-xs font-semibold" style={{ borderColor: C.border, color: C.textSecondary }}>
            Recipients {recipients.length < campaign.total_recipients ? `(showing ${recipients.length} most recent)` : ''}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {recipients.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm" style={{ color: C.textMuted }}>
                No recipients processed yet
              </div>
            ) : (
              recipients.map((r) => (
                <div key={r.id} className="px-4 py-2.5 flex items-center justify-between gap-3 border-b last:border-b-0" style={{ borderColor: C.border }}>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium truncate" style={{ color: C.textPrimary }}>
                      {r.name || r.wa_id}
                    </div>
                    {r.error_message && (
                      <div className="text-[11px] truncate" style={{ color: C.errText }}>
                        {r.error_message}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {r.status === 'read' && <Eye size={16} color={C.accentBright} />}
                    {r.status === 'delivered' && <CheckCircle2 size={16} color={C.accentBright} />}
                    {r.status === 'sent' && <CheckCircle2 size={16} color={C.textSecondary} />}
                    {r.status === 'failed' && <XCircle size={16} color={C.errText} />}
                    {(r.status === 'pending' || !r.status) && <Clock size={16} color={C.textMuted} />}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="text-lg font-semibold" style={{ color }}>
        {value}
      </div>
      <div className="text-[11px]" style={{ color: C.textMuted }}>
        {label}
      </div>
    </div>
  );
}

// ─── Create modal ───────────────────────────────────────────────────────────

function CreateCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: (campaign: Campaign) => void }) {
  const [name, setName] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateName, setTemplateName] = useState('');
  const [headerVariable, setHeaderVariable] = useState('');

  // Per-{{n}} slot: either a literal value, or "__CUSTOMER_NAME__"
  const [bodyVars, setBodyVars] = useState<string[]>([]);
  const [personalizedSlots, setPersonalizedSlots] = useState<boolean[]>([]);

  const [audienceMode, setAudienceMode] = useState<'all' | 'restaurant'>('all');
  const [restaurantName, setRestaurantName] = useState('');
  const [sinceDays, setSinceDays] = useState<string>('');
  const [restaurantOptions, setRestaurantOptions] = useState<RestaurantOption[]>([]);
  const [totalContacts, setTotalContacts] = useState<number | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedTemplate = templates.find((t) => t.name === templateName);

  useEffect(() => {
    (async () => {
      setTemplatesLoading(true);
      try {
        const res = await fetch('/api/whatsapp/templates');
        const data = await res.json();
        if (data.templates) setTemplates(data.templates);
      } finally {
        setTemplatesLoading(false);
      }
    })();
    (async () => {
      const res = await fetch('/api/whatsapp/campaigns/audience-options');
      const data = await res.json();
      if (data.restaurants) setRestaurantOptions(data.restaurants);
      if (typeof data.totalContacts === 'number') setTotalContacts(data.totalContacts);
    })();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      setBodyVars(Array(selectedTemplate.placeholderCount).fill(''));
      setPersonalizedSlots(Array(selectedTemplate.placeholderCount).fill(false));
    }
  }, [templateName]); // eslint-disable-line react-hooks/exhaustive-deps

  const audienceFilter = useMemo(() => {
    const f: { restaurantName?: string; sinceDays?: number } = {};
    if (audienceMode === 'restaurant' && restaurantName) f.restaurantName = restaurantName;
    if (sinceDays && Number(sinceDays) > 0) f.sinceDays = Number(sinceDays);
    return f;
  }, [audienceMode, restaurantName, sinceDays]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPreviewLoading(true);
      try {
        const res = await fetch('/api/whatsapp/campaigns/preview-count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(audienceFilter),
        });
        const data = await res.json();
        if (!cancelled && typeof data.count === 'number') setPreviewCount(data.count);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [audienceFilter]);

  const previewParams = bodyVars.map((v, i) => (personalizedSlots[i] ? '<contact name>' : v));
  const previewText = selectedTemplate ? fillPreview(selectedTemplate.bodyText, previewParams) : '';

  async function handleCreate() {
    setError('');
    if (!name.trim()) return setError('Give the campaign a name');
    if (!selectedTemplate) return setError('Select a template');
    if (bodyVars.some((v, i) => !personalizedSlots[i] && !v.trim())) {
      return setError('Fill in every template variable, or mark it to use the contact\'s name');
    }
    if (audienceMode === 'restaurant' && !restaurantName) return setError('Select a restaurant');

    setSubmitting(true);
    try {
      const finalBodyVars = bodyVars.map((v, i) => (personalizedSlots[i] ? '__CUSTOMER_NAME__' : v));
      const res = await fetch('/api/whatsapp/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          templateName: selectedTemplate.name,
          languageCode: selectedTemplate.language,
          headerVariable: headerVariable || undefined,
          bodyVariables: finalBodyVars,
          audienceFilter,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create campaign');
      onCreated(data.campaign);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(11,20,26,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" style={{ background: '#fff' }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ background: C.headerBg }}>
          <h2 className="font-semibold text-[16px] text-white">New campaign</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10">
            <X size={18} color="#fff" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: C.textPrimary }}>
              Campaign name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. October review push"
              className="w-full border rounded-lg px-3.5 py-2.5 text-sm outline-none"
              style={{ borderColor: C.border, color: C.textPrimary }}
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: C.textPrimary }}>
              Template
            </label>
            {templatesLoading ? (
              <p className="text-xs" style={{ color: C.textMuted }}>Loading templates...</p>
            ) : templates.length === 0 ? (
              <p className="text-xs px-3.5 py-2.5 rounded-lg font-medium" style={{ background: C.warnBg, color: C.warnText }}>
                No approved templates found. Create one in WhatsApp Manager first.
              </p>
            ) : (
              <select
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full border rounded-lg px-3.5 py-2.5 text-sm outline-none"
                style={{ borderColor: C.border, color: C.textPrimary }}
              >
                <option value="">Select a template</option>
                {templates.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.language})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: C.textPrimary }}>
              Header value (only needed if this template has a text header variable)
            </label>
            <input
              value={headerVariable}
              onChange={(e) => setHeaderVariable(e.target.value)}
              placeholder="Optional"
              className="w-full border rounded-lg px-3.5 py-2.5 text-sm outline-none"
              style={{ borderColor: C.border, color: C.textPrimary }}
            />
          </div>

          {selectedTemplate && selectedTemplate.placeholderCount > 0 && (
            <div className="space-y-3">
              <label className="text-xs font-semibold block" style={{ color: C.textPrimary }}>
                Body variables
              </label>
              {Array.from({ length: selectedTemplate.placeholderCount }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    disabled={personalizedSlots[i]}
                    value={personalizedSlots[i] ? "Contact's name" : bodyVars[i] || ''}
                    onChange={(e) => {
                      const next = [...bodyVars];
                      next[i] = e.target.value;
                      setBodyVars(next);
                    }}
                    placeholder={`{{${i + 1}}} value`}
                    className="flex-1 border rounded-lg px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
                    style={{ borderColor: C.border, color: C.textPrimary }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...personalizedSlots];
                      next[i] = !next[i];
                      setPersonalizedSlots(next);
                    }}
                    className="text-[11px] font-semibold px-2.5 py-2 rounded-lg shrink-0"
                    style={{
                      background: personalizedSlots[i] ? C.accentSoft : C.draftBg,
                      color: personalizedSlots[i] ? '#0B3D2E' : C.textSecondary,
                    }}
                  >
                    Use name
                  </button>
                </div>
              ))}
            </div>
          )}

          {selectedTemplate && (
            <div className="text-[13px] px-3.5 py-3 rounded-lg leading-snug" style={{ background: C.accentSoft, color: '#0B3D2E' }}>
              <strong>Preview:</strong> {previewText}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: C.textPrimary }}>
              Audience
            </label>
            <div className="flex rounded-lg border overflow-hidden mb-2" style={{ borderColor: C.border }}>
              <button
                onClick={() => setAudienceMode('all')}
                className="flex-1 py-2 text-xs font-semibold"
                style={{ background: audienceMode === 'all' ? C.accentSoft : '#fff', color: audienceMode === 'all' ? '#0B3D2E' : C.textSecondary }}
              >
                All contacts
              </button>
              <button
                onClick={() => setAudienceMode('restaurant')}
                className="flex-1 py-2 text-xs font-semibold border-l"
                style={{ borderColor: C.border, background: audienceMode === 'restaurant' ? C.accentSoft : '#fff', color: audienceMode === 'restaurant' ? '#0B3D2E' : C.textSecondary }}
              >
                Signed up via one restaurant
              </button>
            </div>

            {audienceMode === 'restaurant' && (
              <select
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                className="w-full border rounded-lg px-3.5 py-2.5 text-sm outline-none mb-2"
                style={{ borderColor: C.border, color: C.textPrimary }}
              >
                <option value="">Select a restaurant</option>
                {restaurantOptions.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name} ({r.count})
                  </option>
                ))}
              </select>
            )}

            <input
              value={sinceDays}
              onChange={(e) => setSinceDays(e.target.value.replace(/\D/g, ''))}
              placeholder="Only contacts active in the last N days (optional)"
              className="w-full border rounded-lg px-3.5 py-2.5 text-sm outline-none"
              style={{ borderColor: C.border, color: C.textPrimary }}
            />

            <div className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: C.textSecondary }}>
              <Users size={13} />
              {previewLoading ? 'Counting…' : `${previewCount ?? totalContacts ?? 0} contacts will receive this`}
            </div>
          </div>

          {error && (
            <p className="text-xs px-3.5 py-2.5 rounded-lg font-medium" style={{ background: C.errBg, color: C.errText }}>
              {error}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t shrink-0" style={{ borderColor: C.border }}>
          <button
            onClick={handleCreate}
            disabled={submitting || !templateName}
            className="w-full py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-transform hover:scale-[1.01]"
            style={{ background: C.accentBright }}
          >
            {submitting ? 'Creating…' : 'Create campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}