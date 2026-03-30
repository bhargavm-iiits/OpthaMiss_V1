import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';

const formatReportDate = (ts) => {
  if (!ts) return 'Unknown date';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return 'Unknown date';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return 'Unknown date'; }
};

const formatReportTime = (ts) => {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

const Reports = () => {
  const navigate = useNavigate();
  const { getScans } = useAuth();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [allReports, setAllReports] = useState([]);

  useEffect(() => {
    const stored = getScans();
    // Sort by latest first
    const sorted = [...stored].sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
      const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
      return dateB - dateA;
    });
    setAllReports(sorted);

    const handler = () => {
      const updated = [...getScans()].sort((a, b) => {
        const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
        const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
        return dateB - dateA;
      });
      setAllReports(updated);
    };
    window.addEventListener('optha_scan_added', handler);
    return () => window.removeEventListener('optha_scan_added', handler);
  }, [getScans]);

  const riskLabel = { HIGH: 'High', MODERATE: 'Moderate', LOW: 'Low', high: 'High', moderate: 'Moderate', low: 'Low' };
  const riskStyle = {
    high: 'bg-red-900/20 text-red-400 border-red-800/30',
    moderate: 'bg-amber-900/20 text-amber-400 border-amber-800/30',
    low: 'bg-green-900/20 text-green-400 border-green-800/30',
    HIGH: 'bg-red-900/20 text-red-400 border-red-800/30',
    MODERATE: 'bg-amber-900/20 text-amber-400 border-amber-800/30',
    LOW: 'bg-green-900/20 text-green-400 border-green-800/30',
  };

  const normalizeRisk = (r) => (r || 'low').toLowerCase();

  const filtered = allReports.filter(function (r) {
    const riskNorm = normalizeRisk(r.risk);
    const matchFilter = filter === 'all' || riskNorm === filter;
    const conditions = r.conditions || [];
    const matchSearch =
      search === '' ||
      (r.id || '').toLowerCase().includes(search.toLowerCase()) ||
      conditions.join(' ').toLowerCase().includes(search.toLowerCase()) ||
      (r.type || '').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const stats = [
    { label: 'Total Reports', value: allReports.length, color: 'text-neutral-200' },
    {
      label: 'High Risk',
      value: allReports.filter(r => normalizeRisk(r.risk) === 'high').length,
      color: 'text-red-400',
    },
    {
      label: 'Moderate Risk',
      value: allReports.filter(r => normalizeRisk(r.risk) === 'moderate').length,
      color: 'text-amber-400',
    },
    {
      label: 'Normal / Low',
      value: allReports.filter(r => normalizeRisk(r.risk) === 'low').length,
      color: 'text-green-400',
    },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-100">Reports</h1>
            <p className="text-sm text-neutral-500 mt-1">
              All your AI eye screening reports
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/screen')}
            className="px-4 py-2 bg-neutral-800 border border-neutral-700/50 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 transition-colors w-fit"
          >
            + New Scan
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div key={i} className="bg-neutral-900 border border-neutral-800/50 rounded-xl p-4">
              <p className={'text-2xl font-bold mb-1 ' + s.color}>{s.value}</p>
              <p className="text-xs text-neutral-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters + Search */}
        <div className="bg-neutral-900 border border-neutral-800/50 rounded-xl p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
              </svg>
              <input
                type="text"
                placeholder="Search by ID, type, condition..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
              />
            </div>

            {/* Risk Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">Filter:</span>
              {['all', 'high', 'moderate', 'low'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all ' +
                    (filter === f
                      ? 'bg-neutral-700 text-neutral-200 border border-neutral-600/50'
                      : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50')
                  }
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Reports List */}
        {allReports.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800/50 rounded-xl p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-neutral-800/50 border border-neutral-700/50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-neutral-400 mb-1">No reports yet</p>
            <p className="text-sm text-neutral-600 mb-4">Run a scan to generate your first report</p>
            <button
              onClick={() => navigate('/screen')}
              className="px-4 py-2 bg-neutral-800 border border-neutral-700/50 rounded-lg text-sm text-neutral-200 hover:bg-neutral-700 transition-all"
            >
              Start Scanning
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800/50 rounded-xl p-12 text-center">
            <p className="text-neutral-400 mb-1">No reports found</p>
            <p className="text-sm text-neutral-600">Try adjusting your search or filter</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((report) => {
              const riskNorm = normalizeRisk(report.risk);
              const riskClass = riskStyle[riskNorm] || riskStyle.low;
              const conditions = report.conditions || [];
              const dateStr = formatReportDate(report.timestamp);
              const timeStr = formatReportTime(report.timestamp);

              return (
                <div
                  key={report.id}
                  onClick={() => navigate('/report/' + report.id)}
                  className="bg-neutral-900 border border-neutral-800/50 rounded-xl p-5 hover:border-neutral-700/50 transition-all cursor-pointer group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left */}
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-neutral-800/50 border border-neutral-700/50 flex items-center justify-center text-lg flex-shrink-0">
                        {report.type === 'Fundus' ? '🔬' : '👁'}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-neutral-200 group-hover:text-neutral-100 transition-colors">
                            {report.id}
                          </h3>
                          <span className="text-xs text-neutral-500 bg-neutral-800/50 px-2 py-0.5 rounded">
                            {report.type}
                          </span>
                          <span className={'px-2 py-0.5 rounded text-xs font-medium border ' + riskClass}>
                            {riskLabel[riskNorm] || riskLabel[report.risk] || 'Low'} Risk
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
                          <span>{dateStr}{timeStr ? ` at ${timeStr}` : ''}</span>
                        </div>
                        {conditions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {conditions.slice(0, 3).map((c, ci) => (
                              <span
                                key={ci}
                                className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800/30 px-2 py-0.5 rounded"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                        {conditions.length === 0 && (
                          <span className="inline-block mt-2 text-xs text-green-400 bg-green-900/20 border border-green-800/30 px-2 py-0.5 rounded">
                            No conditions detected
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right */}
                    <div className="flex items-center gap-2 flex-shrink-0 sm:ml-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/report/' + report.id);
                        }}
                        className="px-3 py-1.5 bg-neutral-800 border border-neutral-700/50 rounded-lg text-xs text-neutral-300 hover:bg-neutral-700 transition-colors"
                      >
                        View Report
                      </button>
                      <svg
                        className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400 group-hover:translate-x-1 transition-all"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Reports;