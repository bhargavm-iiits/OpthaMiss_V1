import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

var formatTimeAgo = function (isoString) {
  if (!isoString) return 'No scans yet';
  var now = new Date();
  var past = new Date(isoString);
  var diffMs = now - past;
  var diffSec = Math.floor(diffMs / 1000);
  var diffMin = Math.floor(diffSec / 60);
  var diffHr = Math.floor(diffMin / 60);
  var diffDay = Math.floor(diffHr / 24);

  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return diffSec + ' seconds ago';
  if (diffMin < 60) return diffMin === 1 ? '1 minute ago' : diffMin + ' minutes ago';
  if (diffHr < 24) return diffHr === 1 ? '1 hour ago' : diffHr + ' hours ago';
  if (diffDay < 7) return diffDay === 1 ? '1 day ago' : diffDay + ' days ago';
  return past.toLocaleDateString();
};

export var useLastScan = function () {
  var { getLastScan } = useAuth();
  var [lastScan, setLastScan] = useState(null);
  var [timeAgo, setTimeAgo] = useState('No scans yet');

  var refresh = useCallback(function () {
    var scan = getLastScan();
    setLastScan(scan);
    setTimeAgo(scan ? formatTimeAgo(scan.timestamp) : 'No scans yet');
  }, [getLastScan]);

  useEffect(function () {
    refresh();

    /* Update every 30 seconds */
    var interval = setInterval(function () {
      var scan = getLastScan();
      setTimeAgo(scan ? formatTimeAgo(scan.timestamp) : 'No scans yet');
    }, 30000);

    /* Listen for new scans */
    var handleNewScan = function (e) {
      setLastScan(e.detail);
      setTimeAgo(formatTimeAgo(e.detail.timestamp));
    };
    window.addEventListener('optha_scan_added', handleNewScan);

    return function () {
      clearInterval(interval);
      window.removeEventListener('optha_scan_added', handleNewScan);
    };
  }, [refresh]);

  return { lastScan: lastScan, timeAgo: timeAgo, refresh: refresh };
};