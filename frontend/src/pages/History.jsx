import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';

const History = () => {
  const navigate = useNavigate();
  const [view, setView] = useState('list'); // 'list' or 'grid'
  const [filter, setFilter] = useState('all'); // 'all', 'anterior', 'fundus'
  const [sortBy, setSortBy] = useState('date'); // 'date', 'risk', 'type'

  // Mock scan history data
  const [scans] = useState([
    {
      id: 'SCN-2025-001',
      type: 'Fundus',
      date: '2025-01-15',
      time: '14:30',
      conditions: ['Glaucoma'],
      risk: 'high',
      thumbnail: '/api/placeholder/200/150',
    },
    {
      id: 'SCN-2025-002',
      type: 'Anterior',
      date: '2025-01-15',
      time: '09:15',
      conditions: [],
      risk: 'low',
      thumbnail: '/api/placeholder/200/150',
    },
    {
      id: 'SCN-2025-003',
      type: 'Fundus',
      date: '2025-01-14',
      time: '16:45',
      conditions: ['AMD'],
      risk: 'moderate',
      thumbnail: '/api/placeholder/200/150',
    },
    {
      id: 'SCN-2025-004',
      type: 'Anterior',
      date: '2025-01-13',
      time: '11:20',
      conditions: ['Cataract'],
      risk: 'moderate',
      thumbnail: '/api/placeholder/200/150',
    },
    {
      id: 'SCN-2025-005',
      type: 'Fundus',
      date: '2025-01-12',
      time: '10:00',
      conditions: [],
      risk: 'low',
      thumbnail: '/api/placeholder/200/150',
    },
  ]);

  const filteredScans = scans
    .filter(scan => filter === 'all' || scan.type.toLowerCase() === filter)
    .sort((a, b) => {
      if (sortBy === 'date') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'risk') {
        const riskOrder = { high: 0, moderate: 1, low: 2 };
        return riskOrder[a.risk] - riskOrder[b.risk];
      }
      return 0;
    });

  const riskColors = {
    high: 'bg-red-900/20 text-red-400 border-red-800/30',
    moderate: 'bg-amber-900/20 text-amber-400 border-amber-800/30',
    low: 'bg-green-900/20 text-green-400 border-green-800/30',
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-100">Scan History</h1>
            <p className="text-sm text-neutral-500 mt-1">
              {filteredScans.length} scan{filteredScans.length !== 1 ? 's' : ''} found
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/screen')}
              className="px-4 py-2 bg-neutral-800 border border-neutral-700/50 rounded-lg text-sm text-neutral-200 hover:bg-neutral-700 transition-all"
            >
              + New Scan
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-neutral-900 border border-neutral-800/50 rounded-xl p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-500">Filter:</span>
              <div className="flex items-center gap-2">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'anterior', label: 'Anterior' },
                  { key: 'fundus', label: 'Fundus' },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                      filter === f.key
                        ? 'bg-neutral-800 text-neutral-200 border border-neutral-700/50'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* View & Sort */}
            <div className="flex items-center gap-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1.5 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-sm text-neutral-300 focus:outline-none focus:border-neutral-600"
              >
                <option value="date">Latest First</option>
                <option value="risk">Highest Risk</option>
                <option value="type">By Type</option>
              </select>

              <div className="flex items-center gap-1 p-1 bg-neutral-800/50 border border-neutral-700/50 rounded-lg">
                <button
                  onClick={() => setView('list')}
                  className={`p-1.5 rounded ${view === 'list' ? 'bg-neutral-700' : ''}`}
                >
                  <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <button
                  onClick={() => setView('grid')}
                  className={`p-1.5 rounded ${view === 'grid' ? 'bg-neutral-700' : ''}`}
                >
                  <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scans List/Grid */}
        {view === 'list' ? (
          <div className="space-y-3">
            {filteredScans.map((scan) => (
              <ScanListItem key={scan.id} scan={scan} riskColors={riskColors} navigate={navigate} />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredScans.map((scan) => (
              <ScanGridItem key={scan.id} scan={scan} riskColors={riskColors} navigate={navigate} />
            ))}
          </div>
        )}

        {filteredScans.length === 0 && (
          <div className="bg-neutral-900 border border-neutral-800/50 rounded-xl p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-neutral-800/50 border border-neutral-700/50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-neutral-400 mb-2">No scans found</p>
            <p className="text-sm text-neutral-600">
              {filter !== 'all' ? 'Try changing your filter' : 'Start your first scan to see history'}
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

const ScanListItem = ({ scan, riskColors, navigate }) => (
  <div
    onClick={() => navigate(`/report/${scan.id}`)}
    className="bg-neutral-900 border border-neutral-800/50 rounded-xl p-4 hover:border-neutral-700/50 transition-all cursor-pointer group"
  >
    <div className="flex items-center gap-4">
      <div className="w-24 h-16 bg-neutral-800/50 rounded-lg overflow-hidden flex-shrink-0">
        <div className="w-full h-full flex items-center justify-center text-neutral-600">
          {scan.type === 'Anterior' ? '👁️' : '🔬'}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <h3 className="text-sm font-medium text-neutral-200 group-hover:text-neutral-100 transition-colors">
            {scan.id}
          </h3>
          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${riskColors[scan.risk]}`}>
            {scan.risk.charAt(0).toUpperCase() + scan.risk.slice(1)}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-neutral-500">
          <span>{scan.type} Scan</span>
          <span>•</span>
          <span>{new Date(scan.date).toLocaleDateString()} at {scan.time}</span>
          {scan.conditions.length > 0 && (
            <>
              <span>•</span>
              <span className="text-amber-400">{scan.conditions.join(', ')}</span>
            </>
          )}
        </div>
      </div>

      <svg className="w-5 h-5 text-neutral-600 group-hover:text-neutral-500 group-hover:translate-x-1 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  </div>
);

const ScanGridItem = ({ scan, riskColors, navigate }) => (
  <div
    onClick={() => navigate(`/report/${scan.id}`)}
    className="bg-neutral-900 border border-neutral-800/50 rounded-xl overflow-hidden hover:border-neutral-700/50 transition-all cursor-pointer group"
  >
    <div className="aspect-video bg-neutral-800/50 flex items-center justify-center text-4xl">
      {scan.type === 'Anterior' ? '👁️' : '🔬'}
    </div>
    <div className="p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-neutral-200 group-hover:text-neutral-100 transition-colors">
          {scan.id}
        </h3>
        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${riskColors[scan.risk]}`}>
          {scan.risk}
        </span>
      </div>
      <p className="text-xs text-neutral-500 mb-2">{scan.type} Scan</p>
      <p className="text-xs text-neutral-600">
        {new Date(scan.date).toLocaleDateString()} • {scan.time}
      </p>
      {scan.conditions.length > 0 && (
        <p className="text-xs text-amber-400 mt-2 truncate">
          {scan.conditions.join(', ')}
        </p>
      )}
    </div>
  </div>
);

export default History;