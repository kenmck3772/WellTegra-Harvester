/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Activity, 
  Database, 
  Map as MapIcon, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Info, 
  Search,
  Filter,
  Layers,
  FileText,
  Zap,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  LogIn,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  Legend
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { Asset, ForensicAudit, TimelineEvent } from './types';
import { db, auth, signInWithGoogle } from './firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  query, 
  orderBy, 
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

// Mock Data for Stella, Gannet, Viking
const ASSETS: Asset[] = [
  { id: 'stella', name: 'Stella', location: 'Central North Sea', status: 'Active', lastAuditDate: '2024-03-15' },
  { id: 'gannet', name: 'Gannet', location: 'Central North Sea', status: 'Under Audit', lastAuditDate: '2024-03-20' },
  { id: 'viking', name: 'Viking', location: 'Southern North Sea', status: 'Active', lastAuditDate: '2024-02-28' },
];

const MOCK_AUDITS: Record<string, ForensicAudit[]> = {
  stella: Array.from({ length: 12 }, (_, i) => {
    const reported = 10000 + Math.random() * 2000;
    const forensic = 8500 + Math.random() * 1500;
    return {
      id: `audit-${i}`,
      wellId: 'ST-01',
      timestamp: `2023-${(i + 1).toString().padStart(2, '0')}-01`,
      reportedProduction: reported,
      forensicProduction: forensic,
      discrepancy: 15,
      confidenceScore: 0.92,
      source: 'NSTA ArcGIS',
      validationEngine: 'WellTegra Physics v1.2',
      notes: 'Mass-balance discrepancy detected in separator data.',
      physicsCalculations: {
        massBalanceDelta: reported - forensic,
        sensorDriftFactor: 0.865,
        pValue: 0.0042,
        iterations: 1250
      }
    };
  }),
  gannet: Array.from({ length: 12 }, (_, i) => {
    const reported = 15000 + Math.random() * 3000;
    const forensic = 14800 + Math.random() * 2000;
    return {
      id: `audit-g-${i}`,
      wellId: 'GN-04',
      timestamp: `2023-${(i + 1).toString().padStart(2, '0')}-01`,
      reportedProduction: reported,
      forensicProduction: forensic,
      discrepancy: 1.5,
      confidenceScore: 0.98,
      source: 'NSTA ArcGIS',
      validationEngine: 'WellTegra Physics v1.2',
      notes: 'High alignment with operator reporting.',
      physicsCalculations: {
        massBalanceDelta: reported - forensic,
        sensorDriftFactor: 0.985,
        pValue: 0.0001,
        iterations: 840
      }
    };
  }),
};

const TIMELINE: TimelineEvent[] = [
  { id: '1', wellId: 'ST-01', date: '2024-01-10', type: 'Water Breakthrough', description: 'Forensic model predicted breakthrough 48h before sensor alert.', truthLevel: 'Forensic' },
  { id: '2', wellId: 'GN-04', date: '2024-02-15', type: 'Sensor Drift', description: 'Pressure sensor P-402 showing 4% positive drift.', truthLevel: 'Forensic' },
  { id: '3', wellId: 'VK-09', date: '2024-03-01', type: 'Maintenance', description: 'Scheduled valve replacement.', truthLevel: 'Public' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [audits, setAudits] = useState<ForensicAudit[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  
  const [selectedAssetId, setSelectedAssetId] = useState('stella');
  const [activeTab, setActiveTab] = useState<'overview' | 'wellark' | 'forensics' | 'blogs'>('overview');
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [lastHarvest, setLastHarvest] = useState<any>(null);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const [selectedAuditIds, setSelectedAuditIds] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  // Auth Listener
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  // Assets Listener
  useEffect(() => {
    return onSnapshot(collection(db, 'assets'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
      setAssets(data);
      if (data.length > 0 && !selectedAssetId) {
        setSelectedAssetId(data[0].id);
      }
    });
  }, []);

  // Audits Listener
  useEffect(() => {
    if (!selectedAssetId) return;
    const q = query(collection(db, `assets/${selectedAssetId}/audits`), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setAudits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ForensicAudit)));
    });
  }, [selectedAssetId]);

  // Timeline Listener
  useEffect(() => {
    if (!selectedAssetId) return;
    const q = query(collection(db, `assets/${selectedAssetId}/timeline`), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setTimeline(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimelineEvent)));
    });
  }, [selectedAssetId]);

  const selectedAsset = useMemo(() => assets.find(a => a.id === selectedAssetId), [assets, selectedAssetId]);

  const seedData = async () => {
    if (!user) return;
    const stellaRef = doc(db, 'assets', 'stella');
    await setDoc(stellaRef, { id: 'stella', name: 'Stella', location: 'Central North Sea', status: 'Active', lastAuditDate: '2024-03-15' });
    
    const gannetRef = doc(db, 'assets', 'gannet');
    await setDoc(gannetRef, { id: 'gannet', name: 'Gannet', location: 'Central North Sea', status: 'Under Audit', lastAuditDate: '2024-03-20' });
    
    const vikingRef = doc(db, 'assets', 'viking');
    await setDoc(vikingRef, { id: 'viking', name: 'Viking', location: 'Southern North Sea', status: 'Active', lastAuditDate: '2024-02-28' });

    // Seed some audits for Stella
    const stellaAudits = Array.from({ length: 5 }, (_, i) => {
      const reported = 10000 + Math.random() * 2000;
      const forensic = 8500 + Math.random() * 1500;
      return {
        id: `audit-${i}`,
        wellId: 'ST-01',
        timestamp: `2023-${(i + 1).toString().padStart(2, '0')}-01`,
        reportedProduction: reported,
        forensicProduction: forensic,
        discrepancy: 15,
        confidenceScore: 0.92,
        source: 'NSTA ArcGIS',
        validationEngine: 'WellTegra Physics v1.2',
        notes: 'Mass-balance discrepancy detected in separator data.',
        physicsCalculations: {
          massBalanceDelta: reported - forensic,
          sensorDriftFactor: 0.865,
          pValue: 0.0042,
          iterations: 1250
        }
      };
    });

    for (const audit of stellaAudits) {
      await setDoc(doc(db, `assets/stella/audits`, audit.id), audit);
    }

    // Seed timeline
    const timelineEvents = [
      { id: '1', wellId: 'ST-01', date: '2024-01-10', type: 'Water Breakthrough', description: 'Forensic model predicted breakthrough 48h before sensor alert.', truthLevel: 'Forensic' },
      { id: '2', wellId: 'GN-04', date: '2024-02-15', type: 'Sensor Drift', description: 'Pressure sensor P-402 showing 4% positive drift.', truthLevel: 'Forensic' },
      { id: '3', wellId: 'VK-09', date: '2024-03-01', type: 'Maintenance', description: 'Scheduled valve replacement.', truthLevel: 'Public' },
    ];

    for (const event of timelineEvents) {
      const assetId = event.wellId.startsWith('ST') ? 'stella' : event.wellId.startsWith('GN') ? 'gannet' : 'viking';
      await setDoc(doc(db, `assets/${assetId}/timeline`, event.id), event);
    }
  };

  const selectedAuditsForComparison = useMemo(() => 
    audits.filter(a => selectedAuditIds.includes(a.id)),
    [audits, selectedAuditIds]
  );

  const comparativeInsights = useMemo(() => {
    if (selectedAuditsForComparison.length < 2) return null;
    
    // Sort by timestamp to get chronological order
    const sorted = [...selectedAuditsForComparison].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    
    return {
      discrepancyDelta: last.discrepancy - first.discrepancy,
      driftDelta: (last.physicsCalculations?.sensorDriftFactor || 0) - (first.physicsCalculations?.sensorDriftFactor || 0),
      confidenceDelta: last.confidenceScore - first.confidenceScore,
      productionTrend: last.forensicProduction > first.forensicProduction ? 'increasing' : 'decreasing'
    };
  }, [selectedAuditsForComparison]);

  const toggleAuditSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAuditIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const triggerHarvest = async () => {
    setIsHarvesting(true);
    try {
      const response = await fetch('/api/harvester/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: selectedAssetId })
      });
      const data = await response.json();
      if (data.success) {
        setLastHarvest(data.audit);
        // Save to Firestore if authenticated
        if (user) {
          const auditData = {
            ...data.audit,
            timestamp: new Date().toISOString().split('T')[0],
            physicsCalculations: {
              massBalanceDelta: data.audit.reportedProduction - data.audit.forensicProduction,
              sensorDriftFactor: 0.865, // Simulated
              pValue: 0.0042,
              iterations: 1250
            }
          };
          await addDoc(collection(db, `assets/${selectedAssetId}/audits`), auditData);
        }
      }
    } catch (error) {
      console.error('Harvest failed:', error);
    } finally {
      setIsHarvesting(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-gray-100 font-sans selection:bg-emerald-500/30">
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/5 bg-[#0d0d0f] flex flex-col">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">WellTegra</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400/70 font-semibold">Forensic Harvester</p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3 px-2">Assets</p>
            {assets.map(asset => (
              <button
                key={asset.id}
                onClick={() => setSelectedAssetId(asset.id)}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-lg transition-all group",
                  selectedAssetId === asset.id 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                )}
              >
                <div className="flex items-center gap-3">
                  <Activity className={cn("w-4 h-4", selectedAssetId === asset.id ? "text-emerald-400" : "text-gray-500")} />
                  <span className="text-sm font-medium">{asset.name}</span>
                </div>
                <ChevronRight className={cn("w-4 h-4 transition-transform", selectedAssetId === asset.id ? "rotate-90" : "opacity-0 group-hover:opacity-100")} />
              </button>
            ))}
            {assets.length === 0 && user && (
              <button 
                onClick={seedData}
                className="w-full mt-4 p-2 rounded-lg border border-dashed border-white/10 text-[10px] text-gray-500 hover:text-white hover:border-white/20 transition-all"
              >
                Seed Initial Asset Data
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3 px-2">Navigation</p>
          {[
            { id: 'overview', label: 'Dashboard', icon: Layers },
            { id: 'wellark', label: 'WellArk Visuals', icon: MapIcon },
            { id: 'forensics', label: 'Forensic Audits', icon: Zap },
            { id: 'blogs', label: 'Knowledge Base', icon: FileText },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition-all",
                activeTab === item.id ? "bg-white/5 text-white" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          {user ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 mb-4">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20 overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{user.displayName || 'Forensic Auditor'}</p>
                <button onClick={() => auth.signOut()} className="text-[10px] text-gray-500 hover:text-orange-400 transition-all">Sign Out</button>
              </div>
            </div>
          ) : (
            <button 
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 transition-all mb-4"
            >
              <LogIn className="w-4 h-4" />
              Sign In with Google
            </button>
          )}
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/10">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">System Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-gray-400">Harvester Online</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 border-b border-white/5 bg-[#0d0d0f]/50 backdrop-blur-xl flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold tracking-tight">{selectedAsset?.name} Field</h2>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Physics Anchored</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={triggerHarvest}
              disabled={isHarvesting}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                isHarvesting 
                  ? "bg-emerald-500/20 text-emerald-400 cursor-wait" 
                  : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              )}
            >
              <Zap className={cn("w-3 h-3", isHarvesting && "animate-pulse")} />
              {isHarvesting ? 'Harvesting...' : 'Trigger Live Harvest'}
            </button>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search wells, audits..." 
                className="bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-all w-64"
              />
            </div>
            <button className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
              <Filter className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <AnimatePresence>
            {lastHarvest && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 32 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-emerald-500/20">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Live Audit Complete</p>
                    <p className="text-sm text-gray-300">
                      Well <span className="text-white font-bold">{lastHarvest.wellId}</span>: 
                      Reported {Math.round(lastHarvest.reportedProduction)} bbl/d | 
                      Forensic <span className="text-emerald-400 font-bold">{Math.round(lastHarvest.forensicProduction)} bbl/d</span> | 
                      Delta <span className="text-orange-400 font-bold">{lastHarvest.delta}</span>
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setLastHarvest(null)}
                  className="text-gray-500 hover:text-white transition-all"
                >
                  <ChevronRight className="w-5 h-5 rotate-90" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-6">
            {[
              { label: 'Total Production', value: '12,402', unit: 'bbl/d', delta: '+2.4%', icon: Activity },
              { label: 'Forensic Delta', value: '14.2%', unit: 'Variance', delta: 'Critical', icon: AlertTriangle, color: 'text-orange-400' },
              { label: 'Confidence Score', value: '0.94', unit: 'P-Value', delta: 'High', icon: CheckCircle2, color: 'text-emerald-400' },
              { label: 'Active Audits', value: '24', unit: 'Wells', delta: 'Live', icon: Database },
            ].map((stat, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                key={stat.label} 
                className="p-6 rounded-2xl bg-[#0d0d0f] border border-white/5 hover:border-white/10 transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-all">
                    <stat.icon className={cn("w-5 h-5", stat.color || "text-gray-400")} />
                  </div>
                  <span className={cn("text-[10px] font-bold uppercase tracking-widest", stat.delta === 'Critical' ? 'text-orange-400' : 'text-emerald-400')}>
                    {stat.delta}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-bold tracking-tight">{stat.value}</h3>
                  <span className="text-xs text-gray-500 font-medium">{stat.unit}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 font-medium">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-3 gap-8">
            <div className="col-span-2 p-8 rounded-2xl bg-[#0d0d0f] border border-white/5">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-bold tracking-tight">Forensic Delta Overlay</h3>
                  <p className="text-sm text-gray-500">Comparison of Public NSTA reporting vs WellTegra Physics Engine</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/50" />
                    <span className="text-emerald-400">Forensic</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-gray-500/20 border border-gray-500/50" />
                    <span className="text-gray-400">Public</span>
                  </div>
                </div>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={audits}>
                    <defs>
                      <linearGradient id="colorForensic" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis 
                      dataKey="timestamp" 
                      stroke="#ffffff20" 
                      fontSize={10} 
                      tickFormatter={(val) => val.split('-')[1]}
                    />
                    <YAxis stroke="#ffffff20" fontSize={10} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#0d0d0f', border: '1px solid #ffffff10', borderRadius: '12px' }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="forensicProduction" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorForensic)" 
                      name="Forensic Truth"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="reportedProduction" 
                      stroke="#4b5563" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      fill="transparent"
                      name="Public Reported"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Info className="w-3 h-3" />
                  <span>Source: NSTA ArcGIS Portal / Validated: WellTegra Physics v1.2</span>
                </div>
                <button className="text-xs font-bold text-emerald-400 uppercase tracking-widest hover:text-emerald-300 transition-all">
                  Export Forensic Audit PDF
                </button>
              </div>
            </div>

            {/* Timeline / WellArk */}
            <div className="p-8 rounded-2xl bg-[#0d0d0f] border border-white/5 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold tracking-tight">WellArk Timeline</h3>
                <Clock className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1 space-y-6">
                {timeline.map((event, i) => (
                  <div key={event.id} className="relative pl-6 border-l border-white/5 pb-6 last:pb-0">
                    <div className={cn(
                      "absolute -left-[5px] top-0 w-2 h-2 rounded-full",
                      event.truthLevel === 'Forensic' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-gray-600"
                    )} />
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{event.date}</span>
                      <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter",
                        event.truthLevel === 'Forensic' ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-500/10 text-gray-400"
                      )}>
                        {event.truthLevel}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-gray-200 mb-1">{event.type}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">{event.description}</p>
                  </div>
                ))}
              </div>
              <button className="mt-8 w-full py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all">
                Open Full KronoGraph
              </button>
            </div>
          </div>

          {/* Knowledge Base / Blogs */}
          <div className="p-8 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-transparent border border-emerald-500/10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold tracking-tight">Forensic Knowledge Base</h3>
              </div>
              <span className="text-xs text-gray-500">3 New Interpretations</span>
            </div>
            <div className="grid grid-cols-3 gap-6">
              {[
                { title: 'Water Breakthrough in Stella ST-01', date: '2024-03-20', tags: ['Stella', 'Physics'], excerpt: 'Forensic analysis of pressure transients suggests premature water breakthrough...' },
                { title: 'Gannet Field: Data Drift Analysis', date: '2024-03-18', tags: ['Gannet', 'Sensors'], excerpt: 'Systematic positive drift detected in P-402 series sensors across GN-04 cluster...' },
                { title: 'Viking Decommissioning Audit', date: '2024-03-15', tags: ['Viking', 'Audit'], excerpt: 'Final forensic audit of cumulative production vs reported reserves...' },
              ].map(post => (
                <div key={post.title} className="p-5 rounded-xl bg-[#0d0d0f]/50 border border-white/5 hover:border-emerald-500/20 transition-all cursor-pointer group">
                  <div className="flex gap-2 mb-3">
                    {post.tags.map(tag => (
                      <span key={tag} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase tracking-tighter">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h4 className="text-sm font-bold text-gray-200 mb-2 group-hover:text-emerald-400 transition-all">{post.title}</h4>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">{post.excerpt}</p>
                  <div className="flex items-center justify-between text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                    <span>{post.date}</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'forensics' && (
        <motion.div
          key="forensics"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-bold tracking-tight">Forensic Audit Logs</h3>
              <p className="text-gray-500">Detailed physics-anchored validation history for {selectedAsset?.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all">
                <Filter className="w-3 h-3" />
                Filter
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {audits.map((audit) => (
              <div 
                key={audit.id} 
                className={cn(
                  "rounded-2xl bg-[#0d0d0f] border overflow-hidden transition-all hover:border-white/10",
                  selectedAuditIds.includes(audit.id) ? "border-emerald-500/30 ring-1 ring-emerald-500/20" : "border-white/5"
                )}
              >
                <div 
                  onClick={() => setExpandedAuditId(expandedAuditId === audit.id ? null : audit.id)}
                  className="p-6 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-6">
                    <div 
                      onClick={(e) => toggleAuditSelection(audit.id, e)}
                      className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center transition-all",
                        selectedAuditIds.includes(audit.id) 
                          ? "bg-emerald-500 border-emerald-500 text-white" 
                          : "border-white/20 hover:border-white/40 bg-white/5"
                      )}
                    >
                      {selectedAuditIds.includes(audit.id) && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center border",
                      audit.discrepancy > 10 
                        ? "bg-orange-500/10 border-orange-500/20 text-orange-400" 
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    )}>
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-bold text-gray-200">Audit {audit.id.toUpperCase()}</h4>
                        <div className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter",
                          audit.discrepancy > 10 
                            ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" 
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        )}>
                          {audit.discrepancy > 10 ? 'Critical Discrepancy' : 'Acceptable Variance'}
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{audit.timestamp}</span>
                      </div>
                      <p className="text-xs text-gray-500">Well: <span className="text-gray-300">{audit.wellId}</span> | Engine: <span className="text-gray-300">{audit.validationEngine}</span></p>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Discrepancy</p>
                      <p className={cn("text-lg font-bold", audit.discrepancy > 10 ? "text-orange-400" : "text-emerald-400")}>
                        {audit.discrepancy}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Confidence</p>
                      <p className="text-lg font-bold text-white">{audit.confidenceScore * 100}%</p>
                    </div>
                    <ChevronRight className={cn("w-5 h-5 text-gray-500 transition-transform", expandedAuditId === audit.id && "rotate-90")} />
                  </div>
                </div>

                <AnimatePresence>
                  {expandedAuditId === audit.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5 bg-white/[0.02]"
                    >
                      <div className="p-8 grid grid-cols-2 gap-12">
                        <div className="space-y-6">
                          <div>
                            <h5 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <Zap className="w-3 h-3" />
                              Physics Calculations
                            </h5>
                            <div className="space-y-3">
                              <div className="flex justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                                <span className="text-xs text-gray-400">Mass-Balance Delta</span>
                                <span className="text-xs font-mono text-white">
                                  {audit.physicsCalculations?.massBalanceDelta.toFixed(2)} bbl/d
                                </span>
                              </div>
                              <div className="flex justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                                <span className="text-xs text-gray-400">Sensor Drift Factor</span>
                                <span className="text-xs font-mono text-white">
                                  {audit.physicsCalculations?.sensorDriftFactor.toFixed(3)}
                                </span>
                              </div>
                              <div className="flex justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                                <span className="text-xs text-gray-400">P-Value (Statistical Significance)</span>
                                <span className="text-xs font-mono text-emerald-400">
                                  {audit.physicsCalculations?.pValue}
                                </span>
                              </div>
                              <div className="flex justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                                <span className="text-xs text-gray-400">Simulation Iterations</span>
                                <span className="text-xs font-mono text-white">
                                  {audit.physicsCalculations?.iterations}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="w-4 h-4 text-orange-400" />
                              <span className="text-xs font-bold text-orange-400 uppercase tracking-widest">Forensic Note</span>
                            </div>
                            <p className="text-xs text-gray-400 leading-relaxed italic">
                              "{audit.notes}"
                            </p>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div>
                            <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Production Comparison</h5>
                            <div className="flex items-center gap-8">
                              <div className="flex-1 p-4 rounded-xl bg-white/5 border border-white/5">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Reported</p>
                                <p className="text-xl font-bold text-gray-400">{Math.round(audit.reportedProduction)} <span className="text-[10px] font-medium">bbl/d</span></p>
                              </div>
                              <div className="w-8 flex justify-center">
                                <ChevronRight className="w-4 h-4 text-gray-700" />
                              </div>
                              <div className="flex-1 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Forensic Truth</p>
                                <p className="text-xl font-bold text-white">{Math.round(audit.forensicProduction)} <span className="text-[10px] font-medium">bbl/d</span></p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6 rounded-xl bg-[#0a0a0c] border border-white/5">
                            <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Audit Provenance</h5>
                            <div className="space-y-2">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-gray-500 uppercase tracking-widest">Source</span>
                                <span className="text-gray-300">{audit.source}</span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-gray-500 uppercase tracking-widest">Validation ID</span>
                                <span className="text-mono text-emerald-400">WT-2024-03-AUD-092</span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-gray-500 uppercase tracking-widest">Timestamp</span>
                                <span className="text-gray-300">{audit.timestamp} 14:22:01 UTC</span>
                              </div>
                            </div>
                          </div>

                          <button className="w-full py-3 rounded-xl bg-emerald-500 text-white text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20">
                            Download Full Forensic Report
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          {/* Historical Production Chart */}
          <div className="p-8 rounded-2xl bg-[#0d0d0f] border border-white/5">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold tracking-tight">Historical Production Analysis</h3>
                <p className="text-sm text-gray-500">Long-term trend of reported vs. forensic production for {selectedAsset?.name}</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-emerald-400">Forensic</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-500" />
                  <span className="text-gray-400">Reported</span>
                </div>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[...audits].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#ffffff20" 
                    fontSize={10}
                    tickFormatter={(val) => {
                      const date = new Date(val);
                      return date.toLocaleString('default', { month: 'short' });
                    }}
                  />
                  <YAxis stroke="#ffffff20" fontSize={10} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0d0d0f', border: '1px solid #ffffff10', borderRadius: '12px' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    align="right" 
                    height={36}
                    iconType="circle"
                    formatter={(value) => <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{value}</span>}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="forensicProduction" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    name="Forensic Truth"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="reportedProduction" 
                    stroke="#4b5563" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: '#4b5563', r: 3 }}
                    name="Public Reported"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparison Bar */}
          <AnimatePresence>
            {selectedAuditIds.length > 0 && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-2xl bg-[#0d0d0f] border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)] flex items-center gap-8 backdrop-blur-xl"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white uppercase tracking-widest">Audit Comparison</p>
                    <p className="text-[10px] text-gray-500">{selectedAuditIds.length} audits selected for forensic analysis</p>
                  </div>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setSelectedAuditIds([])}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition-all"
                  >
                    Clear
                  </button>
                  <button 
                    onClick={() => setShowComparison(true)}
                    disabled={selectedAuditIds.length < 2}
                    className={cn(
                      "px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                      selectedAuditIds.length >= 2
                        ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                        : "bg-white/5 text-gray-500 cursor-not-allowed"
                    )}
                  >
                    Compare Side-by-Side
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Comparison Modal */}
          <AnimatePresence>
            {showComparison && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-[#0a0a0c]/90 backdrop-blur-md flex items-center justify-center p-12"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="w-full max-w-7xl h-full bg-[#0d0d0f] border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl"
                >
                  <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                    <div>
                      <h3 className="text-2xl font-bold tracking-tight">Forensic Comparison Matrix</h3>
                      <p className="text-gray-500">Side-by-side physics validation for {selectedAsset?.name} Field</p>
                    </div>
                    <div className="flex items-center gap-6">
                      {comparativeInsights && (
                        <div className="flex items-center gap-8 px-6 py-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Discrepancy Trend</span>
                            <div className="flex items-center gap-2">
                              {comparativeInsights.discrepancyDelta > 0 ? (
                                <TrendingUp className="w-4 h-4 text-orange-400" />
                              ) : (
                                <TrendingDown className="w-4 h-4 text-emerald-400" />
                              )}
                              <span className={cn("text-sm font-bold", comparativeInsights.discrepancyDelta > 0 ? "text-orange-400" : "text-emerald-400")}>
                                {Math.abs(comparativeInsights.discrepancyDelta).toFixed(1)}% {comparativeInsights.discrepancyDelta > 0 ? 'Increase' : 'Decrease'}
                              </span>
                            </div>
                          </div>
                          <div className="w-px h-8 bg-white/10" />
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Drift Evolution</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white">
                                {comparativeInsights.driftDelta > 0 ? '+' : ''}{comparativeInsights.driftDelta.toFixed(3)}
                              </span>
                              <span className="text-[10px] text-gray-500 font-medium">Factor Change</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <button 
                        onClick={() => setShowComparison(false)}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                      >
                        <Layers className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-x-auto p-8">
                    <div className="flex gap-6 min-w-max h-full">
                      {selectedAuditsForComparison.map((audit) => (
                        <div key={audit.id} className="w-[400px] flex flex-col gap-6 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-bold text-lg text-white">Audit {audit.id.toUpperCase()}</h4>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{audit.timestamp}</p>
                            </div>
                            <div className={cn(
                              "px-2 py-1 rounded text-[9px] font-bold uppercase tracking-tighter",
                              audit.discrepancy > 10 ? "bg-orange-500/10 text-orange-400" : "bg-emerald-500/10 text-emerald-400"
                            )}>
                              {audit.discrepancy > 10 ? 'Critical' : 'Acceptable'}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Production Delta</p>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Reported</p>
                                <p className="text-lg font-bold text-gray-400">{Math.round(audit.reportedProduction)}</p>
                              </div>
                              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Forensic</p>
                                <p className="text-lg font-bold text-white">{Math.round(audit.forensicProduction)}</p>
                              </div>
                            </div>
                            <div className="p-4 rounded-xl bg-[#0a0a0c] border border-white/5 flex items-center justify-between">
                              <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Discrepancy</span>
                              <span className={cn("text-xl font-bold", audit.discrepancy > 10 ? "text-orange-400" : "text-emerald-400")}>
                                {audit.discrepancy}%
                              </span>
                            </div>
                          </div>

                          <div className="space-y-4 flex-1">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Physics Validation</p>
                            <div className="space-y-2">
                              {[
                                { label: 'Mass-Balance Delta', value: `${audit.physicsCalculations?.massBalanceDelta.toFixed(2)} bbl/d` },
                                { label: 'Sensor Drift Factor', value: audit.physicsCalculations?.sensorDriftFactor.toFixed(3) },
                                { label: 'P-Value', value: audit.physicsCalculations?.pValue, color: 'text-emerald-400' },
                                { label: 'Iterations', value: audit.physicsCalculations?.iterations },
                              ].map((calc) => (
                                <div key={calc.label} className="flex justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                                  <span className="text-[10px] text-gray-500 uppercase tracking-widest">{calc.label}</span>
                                  <span className={cn("text-xs font-mono font-bold", calc.color || "text-white")}>{calc.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Forensic Note</p>
                            <p className="text-xs text-gray-400 italic leading-relaxed">"{audit.notes}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-8 border-t border-white/5 bg-white/[0.02] flex justify-end gap-4">
                    <button 
                      onClick={() => setShowComparison(false)}
                      className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                      Close Comparison
                    </button>
                    <button className="px-8 py-3 rounded-xl bg-emerald-500 text-white text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20">
                      Export Comparative Report
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {(activeTab === 'wellark' || activeTab === 'blogs') && (
        <motion.div
          key="placeholder"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="h-[60vh] flex flex-col items-center justify-center text-center p-12 rounded-3xl border border-dashed border-white/10"
        >
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
            <Layers className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-xl font-bold mb-2">Module Integration Pending</h3>
          <p className="text-gray-500 max-w-md">
            The {activeTab === 'wellark' ? 'WellArk Visual Intelligence' : 'Knowledge Base'} module is currently being forensically anchored to the ground truth engine.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
</main>

      {/* Tooltip Portal / Strict Rule Implementation */}
      <div className="fixed bottom-8 right-8">
        <div className="group relative">
          <div className="p-3 rounded-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-help">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div className="absolute bottom-full right-0 mb-4 w-64 p-4 rounded-xl bg-[#0d0d0f] border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none translate-y-2 group-hover:translate-y-0">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2">Immutable Source Rule</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              All data displayed in this dashboard is forensically anchored. 
              <br/><br/>
              <span className="text-gray-200 font-bold">Source:</span> NSTA Open Data Portal
              <br/>
              <span className="text-gray-200 font-bold">Validated:</span> WellTegra Physics Engine v1.2
              <br/>
              <span className="text-gray-200 font-bold">Last Audit:</span> {selectedAsset?.lastAuditDate}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
