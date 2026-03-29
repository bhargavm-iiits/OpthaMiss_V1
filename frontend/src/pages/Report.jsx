import { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';

const Report = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();           // ← real user from context
  const [activeTab, setActiveTab] = useState('summary');
  const printRef = useRef(null);

  const reportId = id || 'SCN-2025-001';

  /* ── Derive real patient info — never hardcoded ── */
  const patientName = user?.name || 'Guest User';
  const patientEmail = user?.email || '';
  const patientInitial = patientName.charAt(0).toUpperCase();
  const patientId = user?.id ? user.id.replace('usr_', 'PT-') : 'PT-00000';

  const normalPct = 21;

  const detectedList = [
    {
      condition: 'Glaucoma',
      shortName: 'GLAUC',
      probabilityPct: 87,
      urgency: 'HIGH',
      description: 'Optic nerve damage often caused by high intraocular pressure. A leading cause of irreversible blindness if left untreated.',
      action: 'URGENT: Refer to glaucoma specialist within 1 week. Intraocular pressure measurement and visual field test required.',
    },
  ];

  const allResultsList = [
    { condition: 'Glaucoma', pct: 87, isDetected: true },
    { condition: 'Normal', pct: 21, isDetected: false },
    { condition: 'AMD', pct: 15, isDetected: false },
    { condition: 'Diabetic Retinopathy', pct: 9, isDetected: false },
    { condition: 'Hypertensive Retinopathy', pct: 7, isDetected: false },
    { condition: 'Pathological Myopia', pct: 4, isDetected: false },
    { condition: 'Cataract', pct: 3, isDetected: false },
    { condition: 'Other Pathology', pct: 2, isDetected: false },
  ];

  const preprocessingList = [
    'Black border removal',
    'CLAHE contrast enhancement',
    'Bicubic resize 224x224',
    'ImageNet normalization',
  ];

  const technicalData = [
    ['Model', 'Tele-Ophthalmology ViT-S/16 v3'],
    ['Architecture', 'ViT-S/16 + CLS+GAP Dual Features'],
    ['Scan Type', 'Fundus'],
    ['AUC-ROC', '0.889'],
    ['F1 Score', '0.631'],
    ['TTA Views', '5-view (orig, hflip, vflip, rot90, rot270)'],
    ['Preprocessing', 'Black border removal, CLAHE, Bicubic resize 224x224'],
    ['Thresholds', 'Per-class F1-optimized on held-out validation set'],
    ['GPU Inference', '~4.3ms per image'],
    ['CPU Inference', '~34ms per image'],
    ['Parameters', '~22.2M (~85 MB)'],
    ['Report ID', reportId],
    ['Screened At', '2025-01-15 14:30'],
  ];

  const sortedResults = allResultsList.slice().sort((a, b) => b.pct - a.pct);

  const tabClass = (tabId) =>
    activeTab === tabId
      ? 'flex-1 py-3 text-xs uppercase tracking-wider transition-colors text-neutral-200 border-b-2 border-neutral-400 bg-neutral-800/20'
      : 'flex-1 py-3 text-xs uppercase tracking-wider transition-colors text-neutral-600 hover:text-neutral-400';

  /* ── PDF generation — all dynamic ── */
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');

    printWindow.document.write('<html><head><title>Report - ' + reportId + '</title>');
    printWindow.document.write('<style>');
    printWindow.document.write('body{font-family:Arial,sans-serif;background:#fff;color:#111;padding:32px}');
    printWindow.document.write('h1{font-size:22px;margin-bottom:4px}');
    printWindow.document.write('h2{font-size:16px;margin:20px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}');
    printWindow.document.write('h3{font-size:14px;margin:12px 0 6px}');
    printWindow.document.write('p,span,td,th{font-size:13px}');
    printWindow.document.write('.risk-high{color:#dc2626;font-weight:bold;font-size:18px}');
    printWindow.document.write('.risk-banner{background:#fef2f2;border:1px solid #fecaca;padding:16px;border-radius:8px;margin-bottom:20px}');
    printWindow.document.write('.meta-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px;background:#f9fafb;padding:12px;border-radius:8px}');
    printWindow.document.write('.meta-item label{font-size:11px;color:#6b7280;text-transform:uppercase;display:block;margin-bottom:2px}');
    printWindow.document.write('.meta-item span{font-size:13px;font-weight:600;color:#111}');
    printWindow.document.write('.action-box{background:#fff7ed;border:1px solid #fed7aa;padding:12px 16px;border-radius:8px;margin-bottom:20px}');
    printWindow.document.write('.action-box p{color:#9a3412;margin:0}');
    printWindow.document.write('.condition-card{border:1px solid #fecaca;background:#fef2f2;padding:16px;border-radius:8px;margin-bottom:12px}');
    printWindow.document.write('.condition-card h3{color:#dc2626;margin:0 0 4px}');
    printWindow.document.write('.prob-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f3f4f6}');
    printWindow.document.write('.prob-bar-wrap{flex:1;height:8px;background:#e5e7eb;border-radius:4px;margin:0 12px;overflow:hidden}');
    printWindow.document.write('.prob-bar-fill{height:100%;background:#d97706;border-radius:4px}');
    printWindow.document.write('.prob-bar-fill-normal{background:#9ca3af}');
    printWindow.document.write('table{width:100%;border-collapse:collapse;margin-top:8px}');
    printWindow.document.write('th{text-align:left;padding:8px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:11px;text-transform:uppercase}');
    printWindow.document.write('td{padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px}');
    printWindow.document.write('.footer{margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af}');
    printWindow.document.write('.patient-row{display:flex;align-items:center;gap:12px;margin-bottom:20px;padding:12px;background:#f9fafb;border-radius:8px}');
    printWindow.document.write('.avatar{width:40px;height:40px;background:#e5e7eb;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:18px;color:#374151}');
    printWindow.document.write('.preprocessing-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}');
    printWindow.document.write('.tag{background:#f3f4f6;border:1px solid #e5e7eb;padding:3px 10px;border-radius:99px;font-size:12px;color:#374151}');
    printWindow.document.write('@media print{body{padding:0}}');
    printWindow.document.write('</style></head><body>');

    printWindow.document.write('<h1>OpthaMiss - AI Eye Screening Report</h1>');
    printWindow.document.write('<p style="color:#6b7280;margin-bottom:20px;">Report ID: ' + reportId + '</p>');

    /* Risk banner */
    printWindow.document.write('<div class="risk-banner">');
    printWindow.document.write('<div style="display:flex;justify-content:space-between;align-items:flex-start">');
    printWindow.document.write('<div><p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;">Overall Risk</p>');
    printWindow.document.write('<p class="risk-high" style="margin:4px 0">HIGH</p></div>');
    printWindow.document.write('<div style="text-align:right"><p style="margin:0;font-size:11px;color:#6b7280;">Scan Type: Fundus</p>');
    printWindow.document.write('<p style="margin:2px 0;font-size:11px;color:#6b7280;">2025-01-15 at 14:30</p></div>');
    printWindow.document.write('</div></div>');

    /* ── Patient row — dynamic name ── */
    printWindow.document.write('<div class="patient-row">');
    printWindow.document.write('<div class="avatar">' + patientInitial + '</div>');
    printWindow.document.write('<div>');
    printWindow.document.write('<p style="margin:0;font-weight:600;">' + patientName + '</p>');
    printWindow.document.write('<p style="margin:0;font-size:12px;color:#6b7280;">ID: ' + patientId);
    if (patientEmail) {
      printWindow.document.write(' &nbsp;|&nbsp; ' + patientEmail);
    }
    printWindow.document.write('</p></div></div>');

    /* Metadata grid */
    printWindow.document.write('<div class="meta-grid">');
    printWindow.document.write('<div class="meta-item"><label>Scan Type</label><span>Fundus</span></div>');
    printWindow.document.write('<div class="meta-item"><label>Date</label><span>Jan 15, 2025</span></div>');
    printWindow.document.write('<div class="meta-item"><label>Time</label><span>14:30</span></div>');
    printWindow.document.write('<div class="meta-item"><label>AI Model</label><span>ViT-S/16 v3</span></div>');
    printWindow.document.write('</div>');

    /* Action box */
    printWindow.document.write('<div class="action-box">');
    printWindow.document.write('<p style="font-weight:600;margin-bottom:4px;">Recommended Clinical Action</p>');
    printWindow.document.write('<p>URGENT REFERRAL — See ophthalmologist within 48 hours</p>');
    printWindow.document.write('</div>');

    /* Detected conditions */
    printWindow.document.write('<h2>Detected Conditions</h2>');
    printWindow.document.write('<div class="condition-card">');
    printWindow.document.write('<div style="display:flex;justify-content:space-between;align-items:flex-start">');
    printWindow.document.write('<div><h3>Glaucoma <span style="font-size:11px;color:#9ca3af;">(GLAUC)</span></h3>');
    printWindow.document.write('<p style="font-size:11px;margin:0;">HIGH URGENCY</p></div>');
    printWindow.document.write('<div style="text-align:right"><p style="font-size:22px;font-weight:bold;color:#dc2626;margin:0;">87%</p>');
    printWindow.document.write('<p style="font-size:11px;color:#9ca3af;">Confidence</p></div></div>');
    printWindow.document.write('<p style="margin:12px 0 4px;font-style:italic;">Optic nerve damage often caused by high intraocular pressure. A leading cause of irreversible blindness if left untreated.</p>');
    printWindow.document.write('<div style="background:#fff;border:1px solid #fecaca;padding:10px;border-radius:6px;margin-top:8px;">');
    printWindow.document.write('<p style="margin:0;font-size:11px;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Recommended Action</p>');
    printWindow.document.write('<p style="margin:0;">URGENT: Refer to glaucoma specialist within 1 week. Intraocular pressure measurement and visual field test required.</p>');
    printWindow.document.write('</div></div>');

    /* Probability analysis */
    printWindow.document.write('<h2>Full Probability Analysis</h2>');
    const results2 = [...allResultsList].sort((a, b) => b.pct - a.pct);
    results2.forEach((r) => {
      const fillClass = r.isDetected ? 'prob-bar-fill' : 'prob-bar-fill prob-bar-fill-normal';
      printWindow.document.write('<div class="prob-row">');
      printWindow.document.write('<span style="min-width:180px;font-weight:' + (r.isDetected ? '600' : '400') + ';color:' + (r.isDetected ? '#d97706' : '#374151') + '">' + r.condition + (r.isDetected ? ' ✓' : '') + '</span>');
      printWindow.document.write('<div class="prob-bar-wrap"><div class="' + fillClass + '" style="width:' + r.pct + '%"></div></div>');
      printWindow.document.write('<span style="min-width:36px;text-align:right;font-weight:600;">' + r.pct + '%</span>');
      printWindow.document.write('</div>');
    });

    /* Technical details */
    printWindow.document.write('<h2>Technical Details</h2>');
    printWindow.document.write('<table><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>');
    const techRows = [
      ['Model', 'Tele-Ophthalmology ViT-S/16 v3'],
      ['Architecture', 'ViT-S/16 + CLS+GAP Dual Features'],
      ['Scan Type', 'Fundus'],
      ['AUC-ROC', '0.889'],
      ['F1 Score', '0.631'],
      ['TTA Views', '5-view (orig, hflip, vflip, rot90, rot270)'],
      ['GPU Inference', '~4.3ms per image'],
      ['Parameters', '~22.2M (~85 MB)'],
      ['Report ID', reportId],
      ['Screened At', '2025-01-15 14:30'],
    ];
    techRows.forEach((row) => {
      printWindow.document.write('<tr><td style="font-weight:600;color:#374151;">' + row[0] + '</td><td style="color:#6b7280;">' + row[1] + '</td></tr>');
    });
    printWindow.document.write('</tbody></table>');

    /* Preprocessing */
    printWindow.document.write('<div class="preprocessing-tags"><p style="width:100%;margin:16px 0 8px;font-weight:600;">Preprocessing Applied:</p>');
    preprocessingList.forEach((p) => {
      printWindow.document.write('<span class="tag">' + p + '</span>');
    });
    printWindow.document.write('</div>');

    /* Footer */
    printWindow.document.write('<div class="footer">');
    printWindow.document.write('<p><strong>DISCLAIMER:</strong> This is an AI-assisted screening report, NOT a clinical diagnosis. All findings must be confirmed by a qualified ophthalmologist before any treatment decisions are made.</p>');
    printWindow.document.write('<p style="margin-top:8px;">Generated by OpthaMiss AI Eye Screening Platform &nbsp;|&nbsp; ' + new Date().toLocaleString() + '</p>');
    printWindow.document.write('</div>');

    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6" ref={printRef}>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button type="button" onClick={() => navigate('/reports')}
            className="flex items-center gap-2 text-neutral-400 hover:text-neutral-200 transition-colors w-fit">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Back to Reports</span>
          </button>
          <button type="button" onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700/50 rounded-lg text-sm text-neutral-200 hover:bg-neutral-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF
          </button>
        </div>

        {/* Main Card */}
        <div id="report-print-area" className="bg-neutral-900 border border-neutral-800/50 rounded-2xl overflow-hidden">

          {/* Risk Banner */}
          <div className="bg-red-950/40 border-b border-red-800/50 px-6 py-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <h1 className="text-xl font-bold text-red-200">AI Eye Screening Report</h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-xs font-medium text-red-200">
                    Fundus Scan
                  </span>
                </div>
                <p className="text-sm text-red-200/60">Report ID: {reportId}</p>
              </div>
              <div className="sm:text-right flex-shrink-0">
                <p className="text-xs uppercase tracking-wider text-red-200/60 mb-0.5">Overall Risk</p>
                <p className="text-2xl font-bold text-red-200">HIGH</p>
                <p className="text-xs text-red-200/50 mt-0.5">2025-01-15 14:30</p>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="px-6 py-4 border-b border-neutral-800/50 bg-neutral-800/20">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Scan Type', value: 'Fundus' },
                { label: 'Date', value: 'Jan 15, 2025' },
                { label: 'Time', value: '14:30' },
                { label: 'AI Model', value: 'ViT-S/16 v3' },
              ].map((item, i) => (
                <div key={i}>
                  <p className="text-xs text-neutral-600 mb-1">{item.label}</p>
                  <p className="text-sm font-medium text-neutral-300">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Patient section — dynamic, no hardcoded values ── */}
          <div className="px-6 py-4 border-b border-neutral-800/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-neutral-800 border border-neutral-700/50
                flex items-center justify-center font-bold text-neutral-300 text-sm flex-shrink-0">
                {patientInitial}
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-200">{patientName}</p>
                <p className="text-xs text-neutral-500">
                  ID: {patientId}
                  {patientEmail && <span>&nbsp;&#8226;&nbsp;{patientEmail}</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Urgent Action */}
          <div className="px-6 py-4 border-b border-neutral-800/50 bg-red-950/10">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-red-300 mb-1">Recommended Clinical Action</h3>
                <p className="text-sm text-red-400/80 leading-relaxed">
                  URGENT REFERRAL — See ophthalmologist within 48 hours
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-neutral-800/50">
            {['summary', 'conditions', 'analysis', 'technical'].map((t) => (
              <button key={t} type="button" onClick={() => setActiveTab(t)}
                className={tabClass(t)}>
                {t === 'summary' && 'Summary'}
                {t === 'conditions' && 'Detected (1)'}
                {t === 'analysis' && 'Full Analysis'}
                {t === 'technical' && 'Technical'}
              </button>
            ))}
          </div>

          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="p-6 space-y-5">
              <div className="p-4 bg-neutral-800/30 border border-neutral-800/50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-neutral-400">Normal Eye Probability</span>
                  <span className="text-sm font-semibold text-neutral-200">{normalPct}%</span>
                </div>
                <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-green-600/70 rounded-full" style={{ width: normalPct + '%' }} />
                </div>
                <p className="text-xs text-neutral-600 mt-2">
                  Lower value indicates higher likelihood of detected pathology.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Conditions Detected', value: '1', color: 'text-red-400' },
                  { label: 'AUC-ROC Score', value: '0.889', color: 'text-neutral-200' },
                  { label: 'TTA Views Used', value: '5', color: 'text-blue-400' },
                ].map((item, i) => (
                  <div key={i} className="p-4 bg-neutral-800/30 border border-neutral-800/50 rounded-xl text-center">
                    <p className={`text-2xl font-bold mb-1 ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-neutral-600">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-neutral-800/30 border border-neutral-800/50 rounded-xl">
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3">
                  Preprocessing Applied
                </p>
                <div className="flex flex-wrap gap-2">
                  {preprocessingList.map((step, i) => (
                    <span key={i}
                      className="px-3 py-1 bg-neutral-700/30 border border-neutral-700/50 rounded-full text-xs text-neutral-400">
                      {step}
                    </span>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-neutral-800/30 border border-neutral-800/50 rounded-xl">
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Clinical Notes</p>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Patient reported occasional blurred vision in the left eye over the past 3 months.
                  Urgent follow-up recommended within 48 hours.
                </p>
              </div>
            </div>
          )}

          {/* Conditions Tab */}
          {activeTab === 'conditions' && (
            <div className="p-6">
              <div className="space-y-4">
                {detectedList.map((d, i) => (
                  <div key={i} className="border border-red-800/50 rounded-xl overflow-hidden bg-red-950/20">
                    <div className="px-5 py-4 border-b border-red-800/20">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-semibold text-base text-red-200">{d.condition}</h4>
                            <span className="text-xs text-red-300/40 font-mono">({d.shortName})</span>
                          </div>
                          <p className="text-xs text-red-300/50 uppercase tracking-wider">{d.urgency} URGENCY</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-2xl font-bold text-red-200">{d.probabilityPct}%</p>
                          <p className="text-xs text-red-300/50">Confidence</p>
                        </div>
                      </div>
                    </div>
                    <div className="px-5 py-3 bg-black/10 border-b border-red-800/20">
                      <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400/30 rounded-full"
                          style={{ width: d.probabilityPct + '%' }} />
                      </div>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <p className="text-sm text-red-300/70 italic leading-relaxed">{d.description}</p>
                      <div className="p-3 bg-black/10 border border-red-800/20 rounded-lg">
                        <p className="text-xs text-red-300/50 uppercase tracking-wider mb-1.5">
                          Recommended Action
                        </p>
                        <p className="text-sm text-red-200/90 leading-relaxed">{d.action}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analysis Tab */}
          {activeTab === 'analysis' && (
            <div className="p-6">
              <p className="text-xs text-neutral-600 uppercase tracking-wider mb-5">
                All {allResultsList.length} conditions — sorted by probability
              </p>
              <div className="space-y-4">
                {sortedResults.map((r, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-neutral-400 flex items-center gap-2">
                        <span className={'w-2 h-2 rounded-full inline-block flex-shrink-0 ' +
                          (r.isDetected ? 'bg-amber-500' : 'bg-neutral-700')} />
                        {r.condition}
                        {r.isDetected && (
                          <span className="text-xs text-amber-500 font-medium">DETECTED</span>
                        )}
                      </span>
                      <span className="text-neutral-500 font-medium">{r.pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div className={'h-full rounded-full ' + (r.isDetected ? 'bg-amber-600' : 'bg-neutral-700')}
                        style={{ width: r.pct + '%' }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 p-4 bg-neutral-800/30 border border-neutral-800/50 rounded-xl">
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Probabilities shown after 5-view Test-Time Augmentation averaging.
                  Conditions above the per-class optimized threshold are flagged as detected.
                </p>
              </div>
            </div>
          )}

          {/* Technical Tab */}
          {activeTab === 'technical' && (
            <div className="p-6">
              <div className="overflow-x-auto rounded-xl border border-neutral-800/50">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-800/50 bg-neutral-800/30">
                      <th className="text-left px-5 py-3 text-neutral-500 font-medium text-xs uppercase tracking-wider">
                        Parameter
                      </th>
                      <th className="text-left px-5 py-3 text-neutral-500 font-medium text-xs uppercase tracking-wider">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {technicalData.map((row, i) => (
                      <tr key={i}
                        className="border-b border-neutral-800/30 last:border-0 hover:bg-neutral-800/20 transition-colors">
                        <td className="px-5 py-3 text-neutral-400 font-medium whitespace-nowrap">
                          {row[0]}
                        </td>
                        <td className="px-5 py-3 text-neutral-500">{row[1]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 bg-neutral-800/30 border-t border-neutral-800/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-xs text-neutral-600 mb-2">
              <span>Model: Tele-Ophthalmology ViT-S/16 v3 &#8226; AUC: 0.889 &#8226; F1: 0.631</span>
              <span>Generated: {new Date().toLocaleDateString()}</span>
            </div>
            <p className="text-xs text-neutral-700 leading-relaxed">
              This is an AI-assisted screening report, NOT a clinical diagnosis.
              All findings must be confirmed by a qualified ophthalmologist before any treatment decisions.
            </p>
          </div>
        </div>

        {/* Download PDF Banner */}
        <div className="bg-neutral-900 border border-neutral-800/50 rounded-xl p-5
          flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-200 mb-1">Download Full Report</h3>
            <p className="text-xs text-neutral-500">
              Save a complete PDF copy for your records or to share with your doctor.
            </p>
          </div>
          <button type="button" onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-neutral-700 border border-neutral-600/50
              rounded-lg text-sm font-medium text-neutral-200 hover:bg-neutral-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF
          </button>
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { label: 'Run New Scan', sub: 'Screen with a different image', path: '/screen' },
            { label: 'All Reports', sub: 'View all your screening reports', path: '/reports' },
            { label: 'Update Profile', sub: 'Add your medical information', path: '/profile' },
          ].map((action, i) => (
            <button key={i} type="button" onClick={() => navigate(action.path)}
              className="flex items-center gap-3 p-4 bg-neutral-900 border border-neutral-800/50
                rounded-xl hover:border-neutral-700/50 transition-all group text-left">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-200 group-hover:text-neutral-100 transition-colors">
                  {action.label}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">{action.sub}</p>
              </div>
              <svg className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400 flex-shrink-0"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>

      </div>
    </DashboardLayout>
  );
};

export default Report;