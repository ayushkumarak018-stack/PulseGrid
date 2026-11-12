import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, Radio, ShieldAlert, Cpu, HardDrive, Zap,
  TrendingUp, RefreshCw, AlertTriangle, CheckCircle2,
  Server, Database, Play, Pause, Download, Filter,
  Clock, BarChart2, PieChart, Layers, Wifi, Terminal
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Cell
} from 'recharts';

interface SensorEvent {
  id: string;
  deviceId: string;
  deviceType: string;
  location: string;
  temperature: number;
  humidity: number;
  pressure: number;
  vibration: number;
  batteryLevel: number;
  status: 'online' | 'warning' | 'critical' | 'offline';
  timestamp: string;
}

interface AnalyticsSummary {
  totalEvents: number;
  activeDevices: number;
  avgTemperature: number;
  avgHumidity: number;
  criticalCount: number;
  warningCount: number;
}

interface TimeseriesPoint {
  timeWindow: string;
  avgTemp: number;
  avgHum: number;
  maxVibration: number;
  eventCount: number;
}

interface DeviceStat {
  deviceId: string;
  deviceType: string;
  location: string;
  status: string;
  lastSeen: string;
  totalEvents: number;
  lastTemp: number;
}

const normalizeEvent = (e: any): SensorEvent => {
  const status = e.status === 'normal' ? 'online' : (e.status || 'online');
  const temp = typeof e.temperature === 'number' ? e.temperature : parseFloat(e.temperature) || 25.0;
  const hum = typeof e.humidity === 'number' ? e.humidity : parseFloat(e.humidity) || 50.0;
  const pm = typeof e.pm25 === 'number' ? e.pm25 : parseFloat(e.pm25) || 20.0;
  const vib = typeof e.vibration === 'number' ? e.vibration : (pm ? pm / 20 : 1.25);
  const battery = typeof e.batteryLevel === 'number' ? e.batteryLevel : (typeof e.battery === 'number' ? e.battery : 85);

  return {
    id: String(e.id || e.event_id || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`),
    deviceId: String(e.deviceId || e.device_id || 'SENSOR-001'),
    deviceType: String(e.deviceType || 'IoT Telemetry Node'),
    location: String(e.location || 'Industrial Facility'),
    temperature: temp,
    humidity: hum,
    pressure: typeof e.pressure === 'number' ? e.pressure : 1013.25,
    vibration: vib,
    batteryLevel: battery,
    status: status as any,
    timestamp: String(e.timestamp || e.recorded_at || new Date().toISOString())
  };
};

export function App() {
  const [events, setEvents] = useState<SensorEvent[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [devices, setDevices] = useState<DeviceStat[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isSimulatorRunning, setIsSimulatorRunning] = useState<boolean>(true);
  const [selectedTab, setSelectedTab] = useState<'dashboard' | 'stream' | 'devices' | 'sql'>('dashboard');
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [customSqlQuery, setCustomSqlQuery] = useState<string>('SELECT device_id, AVG(temperature) as avg_temp, COUNT(*) as cnt FROM iot_sensor_events GROUP BY device_id ORDER BY cnt DESC LIMIT 10;');
  const [sqlResult, setSqlResult] = useState<any[] | null>(null);
  const [sqlLoading, setSqlLoading] = useState<boolean>(false);
  const [sqlError, setSqlError] = useState<string | null>(null);

  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [sumRes, tsRes, devRes, evRes] = await Promise.all([
        fetch('/api/analytics/summary'),
        fetch('/api/analytics/timeseries?minutes=30'),
        fetch('/api/devices'),
        fetch('/api/events?limit=50')
      ]);

      if (sumRes.ok) {
        const json = await sumRes.json();
        const rawSum = json.data || json;
        if (rawSum) {
          setSummary({
            totalEvents: rawSum.totalEvents || 0,
            activeDevices: rawSum.activeDevices || 0,
            avgTemperature: typeof rawSum.avgTemperature === 'number' ? rawSum.avgTemperature : 25.0,
            avgHumidity: typeof rawSum.avgHumidity === 'number' ? rawSum.avgHumidity : 50.0,
            criticalCount: rawSum.criticalCount || 0,
            warningCount: rawSum.warningCount || 0
          });
        }
      }

      if (tsRes.ok) {
        const json = await tsRes.json();
        const rawTs = json.data || json;
        const normalizedTs = Array.isArray(rawTs) ? rawTs.map((item: any) => ({
          timeWindow: item.timeWindow || item.time_label || new Date().toLocaleTimeString(),
          avgTemp: typeof item.avgTemp === 'number' ? item.avgTemp : (typeof item.temperature === 'number' ? item.temperature : 25.0),
          avgHum: typeof item.avgHum === 'number' ? item.avgHum : (typeof item.humidity === 'number' ? item.humidity : 50.0),
          maxVibration: typeof item.maxVibration === 'number' ? item.maxVibration : (typeof item.pm25 === 'number' ? item.pm25 / 15 : 1.2),
          eventCount: item.eventCount || 1
        })) : [];
        setTimeseries(normalizedTs);
      }

      if (devRes.ok) {
        const json = await devRes.json();
        const rawDev = json.data || json;
        const normalizedDev = Array.isArray(rawDev) ? rawDev.map((d: any) => ({
          deviceId: d.deviceId || d.device_id || 'Unknown',
          deviceType: d.deviceType || 'IoT Sensor Node',
          location: d.location || 'Facility Zone',
          status: d.status === 'normal' ? 'online' : (d.status || 'online'),
          lastSeen: d.lastSeen || d.recorded_at || new Date().toISOString(),
          totalEvents: d.totalEvents || 1,
          lastTemp: typeof d.lastTemp === 'number' ? d.lastTemp : (typeof d.temperature === 'number' ? d.temperature : 25.0)
        })) : [];
        setDevices(normalizedDev);
      }

      if (evRes.ok) {
        const json = await evRes.json();
        const rawEvs = json.data || json;
        const normalizedEvents = Array.isArray(rawEvs) ? rawEvs.map(normalizeEvent) : [];
        setEvents(normalizedEvents);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Polling backup for summary/devices
    return () => clearInterval(interval);
  }, []);

  // Connect to SSE Stream
  useEffect(() => {
    const eventSource = new EventSource('/api/stream');

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data);
        if (raw.type === 'CONNECTED') {
          return; // Skip connection handshake packet
        }
        const newEvent = normalizeEvent(raw);
        setEvents(prev => [newEvent, ...prev.slice(0, 199)]); // Keep last 200 events

        // Update summary counts incrementally
        setSummary(prev => {
          if (!prev) return null;
          return {
            ...prev,
            totalEvents: (prev.totalEvents || 0) + 1,
            criticalCount: newEvent.status === 'critical' ? (prev.criticalCount || 0) + 1 : prev.criticalCount,
            warningCount: newEvent.status === 'warning' ? (prev.warningCount || 0) + 1 : prev.warningCount,
          };
        });
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, []);

  const toggleSimulator = async () => {
    try {
      const endpoint = isSimulatorRunning ? '/api/simulator/stop' : '/api/simulator/start';
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        setIsSimulatorRunning(!isSimulatorRunning);
      }
    } catch (err) {
      console.error('Error toggling simulator:', err);
    }
  };

  const runCustomSql = async (e: React.FormEvent) => {
    e.preventDefault();
    setSqlLoading(true);
    setSqlError(null);
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: customSqlQuery })
      });
      const data = await res.json();
      if (res.ok) {
        setSqlResult(data.rows || data);
      } else {
        setSqlError(data.error || 'Query failed');
      }
    } catch (err: any) {
      setSqlError(err.message || 'Network error');
    } finally {
      setSqlLoading(false);
    }
  };

  const filteredEvents = events.filter(ev => {
    if (selectedDevice !== 'all' && ev.deviceId !== selectedDevice) return false;
    if (filterStatus !== 'all' && ev.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Radio className="h-6 w-6 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                PulseGrid
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                v1.0.0
              </span>
            </div>
            <p className="text-xs text-slate-400">Real-Time IoT Streaming Analytics & Timescale Engine</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-mono">
            <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
            <span className="text-slate-300">{isConnected ? 'SSE Stream Active' : 'Disconnected'}</span>
          </div>

          <button
            onClick={toggleSimulator}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              isSimulatorRunning
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
          >
            {isSimulatorRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span>{isSimulatorRunning ? 'Pause Simulator' : 'Start Simulator'}</span>
          </button>

          <button
            onClick={fetchData}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Navigation Sub-bar */}
      <div className="border-b border-slate-800/80 bg-slate-900/40 px-6 flex space-x-6 text-sm font-medium">
        <button
          onClick={() => setSelectedTab('dashboard')}
          className={`py-3 border-b-2 flex items-center space-x-2 transition-colors ${
            selectedTab === 'dashboard'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart2 className="h-4 w-4" />
          <span>Live Dashboard</span>
        </button>
        <button
          onClick={() => setSelectedTab('stream')}
          className={`py-3 border-b-2 flex items-center space-x-2 transition-colors ${
            selectedTab === 'stream'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="h-4 w-4" />
          <span>Live Event Stream ({events.length})</span>
        </button>
        <button
          onClick={() => setSelectedTab('devices')}
          className={`py-3 border-b-2 flex items-center space-x-2 transition-colors ${
            selectedTab === 'devices'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="h-4 w-4" />
          <span>Connected Devices ({devices.length})</span>
        </button>
        <button
          onClick={() => setSelectedTab('sql')}
          className={`py-3 border-b-2 flex items-center space-x-2 transition-colors ${
            selectedTab === 'sql'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="h-4 w-4" />
          <span>SQL Query Console</span>
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto space-y-6">

        {/* TAB 1: DASHBOARD */}
        {selectedTab === 'dashboard' && (
          <>
            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute right-3 top-3 p-3 rounded-xl bg-cyan-500/10 text-cyan-400">
                  <Activity className="h-6 w-6" />
                </div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Ingested Events</p>
                <h3 className="text-3xl font-bold mt-2 font-mono text-white">
                  {summary ? (summary.totalEvents ?? 0).toLocaleString() : '---'}
                </h3>
                <div className="mt-2 flex items-center text-xs text-emerald-400">
                  <TrendingUp className="h-3.5 w-3.5 mr-1" />
                  <span>Real-time ingestion active</span>
                </div>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute right-3 top-3 p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Cpu className="h-6 w-6" />
                </div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active IoT Devices</p>
                <h3 className="text-3xl font-bold mt-2 font-mono text-white">
                  {summary ? (summary.activeDevices ?? 0) : '---'}
                </h3>
                <div className="mt-2 flex items-center text-xs text-slate-400">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                  <span>All telemetry nodes reporting</span>
                </div>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute right-3 top-3 p-3 rounded-xl bg-amber-500/10 text-amber-400">
                  <Zap className="h-6 w-6" />
                </div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Avg Temperature / Humidity</p>
                <h3 className="text-3xl font-bold mt-2 font-mono text-white">
                  {summary ? `${(summary.avgTemperature ?? 0).toFixed(1)}°C` : '---'}
                  <span className="text-sm font-normal text-slate-400 ml-2">({summary ? (summary.avgHumidity ?? 0).toFixed(0) : 0}%)</span>
                </h3>
                <div className="mt-2 flex items-center text-xs text-amber-400">
                  <Clock className="h-3.5 w-3.5 mr-1" />
                  <span>Window: Last 30 minutes</span>
                </div>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute right-3 top-3 p-3 rounded-xl bg-rose-500/10 text-rose-400">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Alerts (Warning / Critical)</p>
                <h3 className="text-3xl font-bold mt-2 font-mono text-white">
                  <span className="text-amber-400">{summary?.warningCount || 0}</span>
                  <span className="text-slate-600 mx-1">/</span>
                  <span className="text-rose-400">{summary?.criticalCount || 0}</span>
                </h3>
                <div className="mt-2 flex items-center text-xs text-rose-400">
                  <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                  <span>Automated anomaly thresholds</span>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Timeseries Temperature Chart */}
              <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-200">Timescale Hypertable: Temperature & Humidity Trend</h2>
                    <p className="text-xs text-slate-400">Aggregated time-series telemetry over 1-minute buckets</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
                    <span className="text-xs text-slate-300">Avg Temp (°C)</span>
                    <span className="h-2 w-2 rounded-full bg-blue-500 ml-2"></span>
                    <span className="text-xs text-slate-300">Humidity (%)</span>
                  </div>
                </div>

                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeseries}>
                      <defs>
                        <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="humGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="timeWindow" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc' }}
                      />
                      <Area type="monotone" dataKey="avgTemp" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#tempGradient)" name="Avg Temp (°C)" />
                      <Area type="monotone" dataKey="avgHum" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#humGradient)" name="Avg Humidity (%)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Vibration / Anomaly Spike Chart */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-200">Max Vibration Spikes</h2>
                    <p className="text-xs text-slate-400">Peak mechanical vibration by time window</p>
                  </div>
                </div>

                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timeseries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="timeWindow" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc' }}
                      />
                      <Bar dataKey="maxVibration" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Max Vibration (mm/s)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Recent Events Live Feed Preview */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-200">Live Ingested Telemetry Feed</h2>
                  <p className="text-xs text-slate-400">Real-time incoming event stream via Server-Sent Events (SSE)</p>
                </div>
                <button
                  onClick={() => setSelectedTab('stream')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  View All Stream &rarr;
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider font-mono">
                    <tr>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Device ID</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Temp</th>
                      <th className="py-3 px-4">Humidity</th>
                      <th className="py-3 px-4">Vibration</th>
                      <th className="py-3 px-4">Battery</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                    {events.slice(0, 6).map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ev.status === 'online' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            ev.status === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            ev.status === 'critical' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse' :
                            'bg-slate-700/10 text-slate-400 border border-slate-700/20'
                          }`}>
                            {(ev.status || 'ONLINE').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : '--:--:--'}</td>
                        <td className="py-3 px-4 text-cyan-400 font-bold">{ev.deviceId}</td>
                        <td className="py-3 px-4 text-slate-300">{ev.deviceType}</td>
                        <td className="py-3 px-4 text-slate-400">{ev.location}</td>
                        <td className="py-3 px-4 text-slate-200">{(ev.temperature ?? 0).toFixed(1)}°C</td>
                        <td className="py-3 px-4 text-slate-200">{(ev.humidity ?? 0).toFixed(0)}%</td>
                        <td className="py-3 px-4 text-slate-200">{(ev.vibration ?? 0).toFixed(2)}</td>
                        <td className="py-3 px-4 text-slate-200">{ev.batteryLevel ?? 0}%</td>
                      </tr>
                    ))}
                    {events.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500">
                          Waiting for incoming events from simulator or ingestion API...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: LIVE STREAM */}
        {selectedTab === 'stream' && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-200">Real-Time Event Stream Inspector</h2>
                <p className="text-xs text-slate-400">Live SSE event stream flowing directly from the ingestion pipeline</p>
              </div>

              <div className="flex items-center space-x-3">
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Devices ({devices.length})</option>
                  {devices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.deviceId} ({d.location})</option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="online">Online</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 max-h-[650px] overflow-y-auto font-mono text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-900/90 sticky top-0 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Device ID</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Temp (°C)</th>
                    <th className="py-3 px-4">Humidity (%)</th>
                    <th className="py-3 px-4">Pressure (hPa)</th>
                    <th className="py-3 px-4">Vibration</th>
                    <th className="py-3 px-4">Battery</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-2.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ev.status === 'online' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          ev.status === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          ev.status === 'critical' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse' :
                          'bg-slate-700/10 text-slate-400 border border-slate-700/20'
                        }`}>
                          {(ev.status || 'ONLINE').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">{ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : '--:--:--'}</td>
                      <td className="py-2.5 px-4 text-cyan-400 font-bold">{ev.deviceId}</td>
                      <td className="py-2.5 px-4 text-slate-300">{ev.deviceType}</td>
                      <td className="py-2.5 px-4 text-slate-400">{ev.location}</td>
                      <td className="py-2.5 px-4 text-slate-200">{(ev.temperature ?? 0).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-slate-200">{(ev.humidity ?? 0).toFixed(1)}</td>
                      <td className="py-2.5 px-4 text-slate-200">{(ev.pressure ?? 1013.2).toFixed(1)}</td>
                      <td className="py-2.5 px-4 text-slate-200">{(ev.vibration ?? 0).toFixed(3)}</td>
                      <td className="py-2.5 px-4 text-slate-200">{ev.batteryLevel ?? 0}%</td>
                    </tr>
                  ))}
                  {filteredEvents.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-500">
                        No events match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CONNECTED DEVICES */}
        {selectedTab === 'devices' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-200">Registered IoT Telemetry Devices</h2>
                <p className="text-xs text-slate-400">Overview of all active sensors connected to the PulseGrid cluster</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {devices.map((dev) => (
                <div key={dev.deviceId} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        <Cpu className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-mono font-bold text-cyan-400">{dev.deviceId}</h3>
                        <p className="text-xs text-slate-400">{dev.deviceType}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      ONLINE
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/50 p-3 rounded-xl border border-slate-800/60">
                    <div>
                      <span className="text-slate-500 block">Location:</span>
                      <span className="text-slate-200">{dev.location}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Last Temp:</span>
                      <span className="text-slate-200">{dev.lastTemp?.toFixed(1) || '--'}°C</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total Events:</span>
                      <span className="text-cyan-400">{dev.totalEvents || 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Last Seen:</span>
                      <span className="text-slate-400">{dev.lastSeen ? new Date(dev.lastSeen).toLocaleTimeString() : '--:--:--'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: SQL QUERY CONSOLE */}
        {selectedTab === 'sql' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-200">TimescaleDB Query Console</h2>
                <p className="text-xs text-slate-400">Execute custom SQL aggregations on the <code className="text-cyan-400">iot_sensor_events</code> hypertable</p>
              </div>

              <form onSubmit={runCustomSql} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-2">SQL Query Editor:</label>
                  <textarea
                    rows={6}
                    value={customSqlQuery}
                    onChange={(e) => setCustomSqlQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                    placeholder="SELECT * FROM iot_sensor_events LIMIT 10;"
                  />
                </div>

                <div className="flex space-x-2">
                  <button
                    type="submit"
                    disabled={sqlLoading}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
                  >
                    <Terminal className="h-4 w-4" />
                    <span>{sqlLoading ? 'Executing Query...' : 'Run Query'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomSqlQuery('SELECT time_bucket(\'1 minute\', timestamp) AS tb, device_id, AVG(temperature) FROM iot_sensor_events GROUP BY tb, device_id ORDER BY tb DESC LIMIT 10;')}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 px-4 rounded-xl text-xs font-mono"
                  >
                    Sample Time-Bucket
                  </button>
                </div>
              </form>

              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2">
                <p className="font-bold text-slate-300">💡 Tiger Data / TimescaleDB Tips:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Hypertable partitioned automatically by timestamp.</li>
                  <li>Use <code className="text-cyan-400">time_bucket('5 minutes', timestamp)</code> for rapid time-series rollups.</li>
                  <li>Supports graceful fallback to in-memory event cache if offline.</li>
                </ul>
              </div>
            </div>

            <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-200">Query Results</h2>
                  <p className="text-xs text-slate-400">
                    {sqlResult ? `${sqlResult.length} rows returned` : 'Run a query to inspect tabular results'}
                  </p>
                </div>
              </div>

              {sqlError && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
                  <strong>Query Error:</strong> {sqlError}
                </div>
              )}

              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 max-h-[500px] overflow-y-auto font-mono text-xs">
                {sqlResult && sqlResult.length > 0 ? (
                  <table className="w-full text-left">
                    <thead className="bg-slate-900/90 sticky top-0 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                      <tr>
                        {Object.keys(sqlResult[0]).map((key) => (
                          <th key={key} className="py-3 px-4">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {sqlResult.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/60 transition-colors">
                          {Object.values(row).map((val: any, vIdx) => (
                            <td key={vIdx} className="py-2.5 px-4 text-slate-300">
                              {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-24 text-center text-slate-500">
                    {sqlLoading ? 'Running query against database...' : 'No query executed or result set is empty.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/80 py-4 px-6 text-center text-xs text-slate-500">
        <p>PulseGrid — Built with React 19, TypeScript, Tailwind CSS, Recharts, Express, and TimescaleDB for MLH Global Hack Week.</p>
      </footer>
    </div>
  );
}
export default App;
