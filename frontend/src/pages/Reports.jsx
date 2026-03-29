import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';

const Reports = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const allReports = [
    {
      id: 'SCN-2025-001',
      type: 'Fundus',
      date: '2025-01-15',
      time: '14:30',
      risk: 'high',
      conditions: ['Glaucoma'],
      model: 'ViT-S/16 v3',
      auc: 0.889,
    },
    {
      id: 'SCN-2025-002',
      type: 'Anterior',
      date: '2025-01-15',
      time: '09:15',
      risk: 'low',
      conditions: [],
      model: 'ViT-S/16 v4',
      auc: 0.982,
    },
    {
      id: 'SCN-2025-003',
      type: 'Fundus',
      date: '2025-01-14',
      time: '16:45',
      risk: 'moderate',
      conditions: ['AMD'],
      model: 'ViT-S/16 v3',
      auc: 0.889,
    },
    {
      id: 'SCN-2025-004',
      type: 'Anterior',
      date: '2025-01-13',
      time: '11:20',
      risk: 'moderate',
      conditions: ['Cataract'],
      model: 'ViT-S/16 v4',
      auc: 0.982,
    },
    {
      id: 'SCN-2025-005',
      type: 'Fundus',
      date: '2025-01-10',
      time: '10:00',
      risk: 'low',
      conditions: [],
      model: 'ViT-S/16 v3',
      auc: 0.889,
    },
    {
      id: 'SCN-2025-006',
      type: 'Anterior',
      date: '2025-01-08',
      time: '13:30',
      risk: 'high',
      conditions: ['Keratitis', 'Corneal Scarring'],
      model: 'ViT-S/16 v4',
      auc: 0.982,
    },
  ];

  const riskLabel = { high: 'High', moderate: 'Moderate', low: 'Low' };

  const riskStyle = {
    high: 'bg-red-900/20 text-red-400 border-red-800/30',
    moderate: 'bg-amber-900/20 text-amber-400 border-amber-800/30',
    low: 'bg-green-900/20 text-green-400 border-green-800/30',
  };

  const filtered = allReports.filter(function (r) {
    const matchFilter = filter === 'all' || r.risk === filter;
    const matchSearch =
      search === '' ||
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.conditions.join(' ').toLowerCase().includes(search.toLowerCase()) ||
      r.type.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const stats = [
    { label: 'Total Reports', value: allReports.length, color: 'text-neutral-200' },
    {
      label: 'High Risk',
      value: allReports.filter(function (r) { return r.risk === 'high'; }).length,
      color: 'text-red-400',
    },
    {
      label: 'Moderate Risk',
      value: allReports.filter(function (r) { return r.risk === 'moderate'; }).length,
      color: 'text-amber-400',
    },
    {
      label: 'Normal / Low',
      value: allReports.filter(function (r) { return r.risk === 'low'; }).length,
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
            onClick={function () { navigate('/screen'); }}
            className="px-4 py-2 bg-neutral-800 border border-neutral-700/50 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 transition-colors w-fit"
          >
            + New Scan
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(function (s, i) {
            return (
              <div
                key={i}
                className="bg-neutral-900 border border-neutral-800/50 rounded-xl p-4"
              >
                <p className={'text-2xl font-bold mb-1 ' + s.color}>{s.value}</p>
                <p className="text-xs text-neutral-500">{s.label}</p>
              </div>
            );
          })}
        </div>

        {/* Filters + Search */}
        <div className="bg-neutral-900 border border-neutral-800/50 rounded-xl p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"
                />
              </svg>
              <input
                type="text"
                placeholder="Search by ID, type, condition..."
                value={search}
                onChange={function (e) { setSearch(e.target.value); }}
                className="w-full pl-10 pr-4 py-2 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
              />
            </div>

            {/* Risk Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">Filter:</span>
              {['all', 'high', 'moderate', 'low'].map(function (f) {
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={function () { setFilter(f); }}
                    className={
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all ' +
                      (filter === f
                        ? 'bg-neutral-700 text-neutral-200 border border-neutral-600/50'
                        : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50')
                    }
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Reports List */}
        {filtered.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800/50 rounded-xl p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-neutral-800/50 border border-neutral-700/50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-neutral-400 mb-1">No reports found</p>
            <p className="text-sm text-neutral-600">Try adjusting your search or filter</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(function (report) {
              return (
                <div
                  key={report.id}
                  onClick={function () { navigate('/report/' + report.id); }}
                  className="bg-neutral-900 border border-neutral-800/50 rounded-xl p-5 hover:border-neutral-700/50 transition-all cursor-pointer group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                    {/* Left */}
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-neutral-800/50 border border-neutral-700/50 flex items-center justify-center text-lg flex-shrink-0">
                        {report.type === 'Fundus' ? '👁' : '🔬'}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-neutral-200 group-hover:text-neutral-100 transition-colors">
                            {report.id}
                          </h3>
                          <span className="text-xs text-neutral-500 bg-neutral-800/50 px-2 py-0.5 rounded">
                            {report.type}
                          </span>
                          <span className={'px-2 py-0.5 rounded text-xs font-medium border ' + riskStyle[report.risk]}>
                            {riskLabel[report.risk]} Risk
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
                          <span>{new Date(report.date).toLocaleDateString()} at {report.time}</span>
                          <span>Model: {report.model}</span>
                          <span>AUC: {report.auc}</span>
                        </div>
                        {report.conditions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {report.conditions.map(function (c, ci) {
                              return (
                                <span
                                  key={ci}
                                  className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800/30 px-2 py-0.5 rounded"
                                >
                                  {c}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {report.conditions.length === 0 && (
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
                        onClick={function (e) {
                          e.stopPropagation();
                          navigate('/report/' + report.id);
                        }}
                        className="px-3 py-1.5 bg-neutral-800 border border-neutral-700/50 rounded-lg text-xs text-neutral-300 hover:bg-neutral-700 transition-colors"
                      >
                        View Report
                      </button>
                      <svg
                        className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400 group-hover:translate-x-1 transition-all"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
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