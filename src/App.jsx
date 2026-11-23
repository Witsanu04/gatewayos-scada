import React, { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, ArrowLeft, Check, Copy, Cpu, Database, Download, Eye, EyeOff, FileSpreadsheet, Gauge, ImagePlus, LayoutDashboard, LineChart, Moon, RefreshCw, RotateCcw, Save, Sliders, Sun, Table2, Tag, Trash2, Upload } from 'lucide-react';
import './builder.css';

// โครงสร้าง PLC Tag จริง (ผูกชื่อ Tag กับ PLC Address / Register และชนิดข้อมูล)
const initialTagDefs = [
  { key: 'run', address: 'M0.0 / %Q0.0', dataType: 'BOOL', value: false, desc: 'สถานะเดินเครื่องจักรหลัก (Ladder Coil)' },
  { key: 'count', address: 'D100 / %MW10', dataType: 'INT', value: 0, desc: 'ตัวนับจำนวนชิ้นงานจาก Counter C0' },
  { key: 'temp', address: 'D102 / %IW64', dataType: 'REAL', value: 0, desc: 'อุณหภูมิจาก Analog Input (Thermocouple)' },
  { key: 'level', address: 'D104 / %IW66', dataType: 'REAL', value: 0, desc: 'ระดับของเหลวในถังจาก Level Sensor' },
  { key: 'kw', address: 'D106 / %MD20', dataType: 'REAL', value: 0, desc: 'กำลังไฟฟ้าจาก Power Meter (Modbus)' }
];

const defaultPanels = [
  { id: 'oee', type: 'stat', title: 'ประสิทธิผลโดยรวม (OEE)', desc: 'คำนวณจากสถานะเครื่องจักรจริง', tag: 'oee', unit: '%', color: 'green', min: 0, max: 100, decimals: 1, warn: 75, crit: 60, span: 1 },
  { id: 'count', type: 'stat', title: 'ยอดการผลิตสะสม', desc: 'PLC Counter (D100)', tag: 'count', unit: ' ชิ้น', color: 'blue', min: 0, max: 800, decimals: 0, warn: 900, crit: 1000, span: 1 },
  { id: 'temp', type: 'gauge', title: 'อุณหภูมิกระบวนการผลิต', desc: 'PLC Analog (D102)', tag: 'temp', unit: ' °C', color: 'orange', min: 0, max: 120, decimals: 1, warn: 80, crit: 95, span: 1 },
  { id: 'level', type: 'gauge', title: 'ระดับของเหลวในถัง', desc: 'PLC Analog (D104)', tag: 'level', unit: '%', color: 'blue', min: 0, max: 100, decimals: 1, warn: 85, crit: 95, span: 1 },
  { id: 'rate', type: 'trend', title: 'แนวโน้มยอดการผลิต (Production)', desc: 'แสดงผลจากข้อมูลที่ซิงก์เข้ามาจริง', tag: 'count', unit: ' ชิ้น', color: 'green', min: 0, max: 1000, decimals: 0, warn: 900, crit: 1000, span: 2 },
  { id: 'energy', type: 'trend', title: 'การใช้พลังงานไฟฟ้า', desc: 'แสดงผลจากข้อมูลที่ซิงก์เข้ามาจริง', tag: 'kw', unit: ' kW', color: 'yellow', min: 0, max: 20, decimals: 1, warn: 12, crit: 15, span: 2 },
  { id: 'tags', type: 'table', title: 'ตารางตัวแปร PLC (PLC Tag Mapping)', desc: 'ค่าและ Address ที่ผูกกับ Ladder', tag: 'all', color: 'blue', span: 2 },
  { id: 'alarms', type: 'alarms', title: 'สถานะการแจ้งเตือน (Alert List)', desc: 'ตรวจสอบเงื่อนไข Threshold', tag: 'all', color: 'red', span: 2 }
];

const types = [
  ['stat', 'ตัวเลขสถิติ (Stat)', Activity],
  ['gauge', 'เกจวัดค่า (Gauge)', Gauge],
  ['trend', 'กราฟเส้น (Time series)', LineChart],
  ['machine', 'รูปเครื่องจักร / Robot (PNG)', Cpu],
  ['table', 'ตาราง (Table)', Table2],
  ['alarms', 'แจ้งเตือน (Alert list)', AlertTriangle]
];

const getValue = (panel, tags) => panel.tag === 'oee' ? (tags.run ? 100.0 : 0) : tags[panel.tag] ?? 0;

function getThresholdColor(panel, val) {
  const num = Number(val);
  if (isNaN(num)) return panel.color || 'blue';
  if (panel.crit !== undefined && panel.crit !== '' && num >= Number(panel.crit)) return 'red';
  if (panel.warn !== undefined && panel.warn !== '' && num >= Number(panel.warn)) return 'orange';
  return panel.color || 'blue';
}

function RealChart({ series, isDark }) {
  if (!series || series.length < 2) {
  return (
      <div className="trend" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#64748b' : '#94a3b8', fontSize: '11px' }}>
        <svg viewBox="0 0 220 75" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
          <line x1="0" y1="68" x2="220" y2="68" stroke={isDark ? '#334155' : '#cbd5e1'} strokeWidth="1.5" strokeDasharray="4 4" />
        </svg>
        <span>รอข้อมูลนำเข้า (ยังไม่มีประวัติข้อมูล)</span>
      </div>
    );
  }
  const nums = series.map(n => Number(n) || 0);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const pts = nums.map((val, idx) => {
    const x = (idx / (nums.length - 1)) * 220;
    const y = 66 - ((val - min) / span) * 54;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="trend">
      <svg viewBox="0 0 220 75" preserveAspectRatio="none">
        <polyline points={pts} />
      </svg>
    </div>
  );
}

function DashboardPanel({ panel, tags, tagDefs, history, selected, onSelect, previewMode, onUploadImage, isDark }) {
  const v = getValue(panel, tags);
  const dec = Number.isInteger(Number(panel.decimals)) ? Number(panel.decimals) : (panel.tag === 'oee' ? 1 : 0);
  const activeColor = getThresholdColor(panel, v);
  const minVal = Number(panel.min ?? 0);
  const maxVal = Number(panel.max ?? 100);
  const pct = maxVal > minVal ? Math.min(100, Math.max(0, ((Number(v) - minVal) / (maxVal - minVal)) * 100)) : 0;
  const tagMeta = tagDefs.find(t => t.key === panel.tag);

  let body;
  if (panel.type === 'stat') {
    body = (
      <>
        <strong className={'big ' + activeColor}>{Number(v).toFixed(dec)}</strong>
        <span className="unit">{panel.unit}</span>
        <small>{panel.desc || (tagMeta ? `${tagMeta.key} (${tagMeta.address})` : `Tag: ${panel.tag}`)}</small>
      </>
    );
  }
  if (panel.type === 'gauge') {
    body = (
      <>
        <div className={'dial ' + activeColor} style={{ '--value': pct + '%' }}>
          <b>{Number(v).toFixed(dec)}<em>{panel.unit}</em></b>
        </div>
        <small>{panel.desc || (tagMeta ? `${tagMeta.key} (${tagMeta.address})` : `Min: ${minVal} · Max: ${maxVal}`)}</small>
      </>
    );
  }
  if (panel.type === 'trend') {
    body = (
      <>
        <RealChart series={history[panel.tag]} isDark={isDark} />
        <div className="legend">
          <span>ค่าล่าสุด: {Number(v).toFixed(dec)}{panel.unit}</span>
          <span>{tagMeta ? `${tagMeta.key} [${tagMeta.address}]` : panel.tag}</span>
        </div>
      </>
    );
  }
  if (panel.type === 'machine') {
    const isRunning = Boolean(tags[panel.tag]);
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', padding: '4px' }}>
        {panel.imgSrc ? (
          <img
            src={panel.imgSrc}
            alt={panel.title}
            style={{
              maxHeight: '115px',
              maxWidth: '100%',
              objectFit: 'contain',
              filter: isRunning ? 'drop-shadow(0 0 8px rgba(34,197,94,0.4))' : 'grayscale(60%) opacity(0.8)'
            }}
          />
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUploadImage(panel.id); }}
            style={{
              border: '1.5px dashed #475569',
              background: isDark ? '#0f172a' : '#f1f5f9',
              color: isDark ? '#94a3b8' : '#475569',
              borderRadius: '6px',
              padding: '16px 12px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px'
            }}
          >
            <ImagePlus size={22} color="#0284c7" />
            <span>คลิกอัปโหลดรูปเครื่องจักร / Robot (.PNG)</span>
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: isRunning ? '#22c55e' : '#64748b' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: isRunning ? '#22c55e' : '#64748b' }} />
          <span>{isRunning ? 'STATUS: RUNNING' : 'STATUS: STANDBY'} ({panel.tag}{tagMeta ? ` · ${tagMeta.address}` : ''})</span>
        </div>
      </div>
    );
  }
  if (panel.type === 'table') {
    body = (
      <div className="mini-table">
        {tagDefs.slice(0, 4).map(t => (
          <div key={t.key}>
            <span>{t.key} <small style={{ opacity: 0.6 }}>({t.address})</small></span>
            <b>{String(t.value)}</b>
            <i style={{ whiteSpace: 'nowrap' }}>{t.dataType}</i>
          </div>
        ))}
      </div>
    );
  }
  if (panel.type === 'alarms') {
    body = Number(tags.temp) >= 80 ? (
      <div className="alarm-content" style={{ color: '#ef4444' }}>
        <AlertTriangle />
        <b>แจ้งเตือน: อุณหภูมิสูงเกินเกณฑ์ ({tags.temp} °C)</b>
        <span>ตรวจสอบค่า Threshold บน Panel</span>
      </div>
    ) : (
      <div className="alarm-content">
        <Check />
        <b>สถานะปกติ (Normal)</b>
        <span>{panel.desc || 'ค่าทุกตัวแปรอยู่ในเกณฑ์มาตรฐาน'}</span>
      </div>
    );
  }

  return (
    <article
      onClick={previewMode ? undefined : onSelect}
      className={'dash-panel type-' + panel.type + (!previewMode && selected ? ' selected' : '')}
      style={{
        cursor: previewMode ? 'default' : 'pointer',
        gridColumn: panel.span === 2 ? 'span 2' : 'span 1',
        background: isDark ? undefined : '#ffffff',
        borderColor: !previewMode && selected ? '#ea580c' : (isDark ? undefined : '#cbd5e1'),
        color: isDark ? undefined : '#0f172a'
      }}
    >
      <div className="panel-head" style={{ borderBottomColor: isDark ? undefined : '#e2e8f0', color: isDark ? undefined : '#334155' }}>
        <span>{panel.title}</span><span>⋮</span>
      </div>
      <div className="panel-body">{body}</div>
    </article>
  );
}

function DataSourcesPage({ tagDefs, onSyncData, activeSource, setActiveSource, showNotice, isDark }) {
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetStatus, setSheetStatus] = useState('วางลิงก์ Google Sheets (Publish to web -> CSV) หรืออัปโหลดไฟล์ .CSV');
  const [dbType, setDbType] = useState('PostgreSQL');
  const [dbHost, setDbHost] = useState('');
  const [dbName, setDbName] = useState('');
  const [dbQuery, setDbQuery] = useState('');
  const [dbStatus, setDbStatus] = useState('ระบุ Endpoint API ของฐานข้อมูลเพื่อดึงข้อมูลจริง');
  const csvInputRef = useRef(null);

  const cardStyle = isDark ? undefined : { background: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' };

  const syncGoogleSheet = async () => {
    if (!sheetUrl.trim()) {
      setSheetStatus('กรุณาวางลิงก์ Google Sheets CSV ก่อนกดซิงก์');
      return;
    }
    setSheetStatus('กำลังดึงข้อมูลจริงจาก Google Sheets...');
    try {
      const res = await fetch(sheetUrl.trim());
      if (!res.ok) throw new Error('HTTP error');
      const text = await res.text();
      parseCsvToTags(text, 'Google Sheets (Live CSV)');
    } catch {
      setSheetStatus('ดึงลิงก์ไม่สำเร็จ (ลิงก์ต้องตั้งค่า Publish to web เป็น CSV และเปิดสิทธิ์สาธารณะ หรือใช้วิธีอัปโหลดไฟล์ .CSV ด้านข้าง)');
    }
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      parseCsvToTags(ev.target.result, `CSV / Google Sheets (${file.name})`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const parseCsvToTags = (csvText, sourceLabel) => {
    const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      setSheetStatus('ไฟล์ตารางต้องมีหัวคอลัมน์ (แถวที่ 1) และข้อมูลอย่างน้อย 1 แถว');
      return;
    }
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const newHist = {};
    headers.forEach(h => { if (h) newHist[h] = []; });

    let latestRowObj = {};
    for (let r = 1; r < lines.length; r++) {
      const cols = lines[r].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const rowObj = {};
      headers.forEach((key, i) => {
        if (!key || cols[i] === undefined) return;
        const val = cols[i];
        let parsedVal = val;
        if (val.toLowerCase() === 'true') parsedVal = true;
        else if (val.toLowerCase() === 'false') parsedVal = false;
        else if (!isNaN(Number(val)) && val !== '') parsedVal = Number(val);
        rowObj[key] = parsedVal;
        if (typeof parsedVal === 'number') newHist[key].push(parsedVal);
      });
      latestRowObj = rowObj;
    }

    if (Object.keys(latestRowObj).length > 0) {
      onSyncData(latestRowObj, newHist, sourceLabel);
      setSheetStatus(`นำเข้าข้อมูลจริงสำเร็จ! อ่านข้อมูล ${lines.length - 1} แถว (${Object.keys(latestRowObj).length} คอลัมน์)`);
      showNotice(`ซิงก์ข้อมูลจาก ${sourceLabel} สำเร็จ ✓`);
    }
  };

  const fetchDatabaseApi = async () => {
    if (!dbHost.trim()) {
      setDbStatus('กรุณากรอก API Endpoint URL ของฐานข้อมูลก่อนกดดึงข้อมูล');
      return;
    }
    setDbStatus(`กำลังเชื่อมต่อและดึงข้อมูลจริงจาก ${dbType}...`);
    try {
      const url = dbHost.startsWith('http') ? dbHost.trim() : `http://${dbHost.trim()}`;
      const hasQuery = dbQuery.trim().length > 0;
      const res = await fetch(url, hasQuery ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbType, database: dbName.trim(), query: dbQuery.trim() })
      } : { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      const payload = raw.rows || raw.data || raw;
      const rows = Array.isArray(payload) ? payload : [payload];
      if (rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
        const newHist = {};
        Object.keys(rows[0]).forEach(k => { newHist[k] = []; });
        rows.forEach(r => {
          Object.entries(r).forEach(([k, v]) => {
            if (typeof v === 'number') newHist[k].push(v);
          });
        });
        const latest = rows[rows.length - 1];
        const label = `${dbType} (${dbName || 'Live API'})`;
        onSyncData(latest, newHist, label);
        setDbStatus(`เชื่อมต่อสำเร็จ! ดึงข้อมูลจริง ${rows.length} แถวเข้า Dashboard แล้ว`);
        showNotice(`ดึงข้อมูลจาก ${dbType} สำเร็จ ✓`);
      } else {
        setDbStatus('เชื่อมต่อสำเร็จ แต่รูปแบบข้อมูลไม่ใช่ JSON Object / Array');
      }
    } catch (err) {
      setDbStatus(`เชื่อมต่อไม่สำเร็จ (${err.message}) — ตรวจสอบ URL, CORS หรือสถานะ API Server`);
    }
  };

  return (
    <main className="settings-page" style={{ color: isDark ? undefined : '#0f172a' }}>
      <h1>แหล่งข้อมูลจริง (Data Sources: Google Sheets &amp; Database)</h1>
      <p style={{ color: isDark ? undefined : '#475569' }}>
        นำเข้าข้อมูลจริงจากตาราง Google Sheets, ไฟล์ CSV หรือฐานข้อมูลเพื่อแสดงผลบนกราฟและเกจ (ไม่มีข้อมูลจำลอง)
      </p>

      <section className="connect-card" style={cardStyle}>
        <div className="connect-icon" style={{ background: 'rgba(34,197,94,0.15)', color: '#16a34a' }}>
          <FileSpreadsheet />
        </div>
        <div>
          <h2>Google Sheets / ตาราง CSV</h2>
          <p>แถวที่ 1 คือชื่อคอลัมน์ (เช่น <code>temp,level,count,kw,run</code>) แถวถัดไปคือข้อมูลจริงที่จะวาดกราฟ</p>
        </div>
        <span className="badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#16a34a', whiteSpace: 'nowrap' }}>SHEETS / CSV</span>
        <div className="connect-form wide" style={{ flexWrap: 'wrap' }}>
          <label style={{ flex: 1, minWidth: '240px' }}>ลิงก์ Google Sheets (Publish CSV URL)
            <input value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv" />
          </label>
          <button type="button" onClick={syncGoogleSheet} style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <RefreshCw size={14} /> ดึงข้อมูลจากลิงก์
          </button>
          <button type="button" className="secondary" onClick={() => csvInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <Upload size={14} /> เลือกไฟล์ .CSV จากเครื่อง
          </button>
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleCsvUpload} />
        </div>
        <small className="connection-state">{sheetStatus}</small>
      </section>

      <section className="connect-card" style={cardStyle}>
        <div className="connect-icon" style={{ background: 'rgba(2,132,199,0.15)', color: '#0284c7' }}>
          <Database />
        </div>
        <div>
          <h2>ฐานข้อมูล (PostgreSQL / MySQL / InfluxDB REST API)</h2>
          <p>เชื่อมต่อ API ของฐานข้อมูลเพื่อดึงข้อมูลจริง (JSON Array หรือ Object) เข้ามาวาดกราฟ</p>
        </div>
        <span className="badge" style={{ whiteSpace: 'nowrap' }}>DATABASE</span>
        <div className="connect-form wide" style={{ display: 'grid', gridTemplateColumns: '200px 1fr 180px auto', gap: '10px', alignItems: 'end' }}>
          <label style={{ margin: 0 }}>ชนิดฐานข้อมูล
            <select value={dbType} onChange={e => setDbType(e.target.value)}>
              <option value="PostgreSQL">PostgreSQL / PostgREST</option>
              <option value="MySQL">MySQL REST API</option>
              <option value="InfluxDB">InfluxDB Query API</option>
            </select>
          </label>
          <label style={{ margin: 0 }}>API Endpoint URL
            <input value={dbHost} onChange={e => setDbHost(e.target.value)} placeholder="เช่น http://localhost:3000/api/metrics" />
          </label>
          <label style={{ margin: 0 }}>ชื่อฐานข้อมูล (Database)
            <input value={dbName} onChange={e => setDbName(e.target.value)} placeholder="ระบุชื่อฐานข้อมูล" />
          </label>
          <button type="button" onClick={fetchDatabaseApi} style={{ whiteSpace: 'nowrap', height: '36px', padding: '0 16px', fontSize: '13px' }}>
            ดึงข้อมูลจริง
          </button>
        </div>
        <div style={{ gridColumn: '2 / -1', marginTop: '6px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: isDark ? '#94a3b8' : '#475569', marginBottom: '4px' }}>คำสั่ง SQL / Flux Query (ส่งแบบ POST JSON หากระบุ)</label>
          <input
            value={dbQuery}
            onChange={e => setDbQuery(e.target.value)}
            placeholder="ระบุคำสั่ง SQL หรือเว้นว่างไว้หากดึงผ่าน REST GET Endpoint โดยตรง"
            style={{ width: '100%', padding: '8px 10px', background: isDark ? '#0c1117' : '#f8fafc', border: `1px solid ${isDark ? '#26303d' : '#cbd5e1'}`, borderRadius: '6px', color: isDark ? '#e2e8f0' : '#0f172a', fontFamily: 'monospace', fontSize: '12px', boxSizing: 'border-box' }}
          />
        </div>
        <small className="connection-state" style={{ gridColumn: '2 / -1' }}>{dbStatus}</small>
      </section>

      <section className="tag-preview" style={cardStyle}>
        <h2>คอลัมน์ข้อมูลปัจจุบัน ({tagDefs.length} Fields) — แหล่งข้อมูล: {activeSource}</h2>
        {tagDefs.map(t => (
          <div key={t.key} style={{ borderBottomColor: isDark ? undefined : '#e2e8f0', display: 'grid', gridTemplateColumns: '24px 160px 1fr 110px 90px', alignItems: 'center', gap: '8px' }}>
            <Tag size={14} />
            <b>{t.key}</b>
            <span>PLC Address: <code>{t.address}</code> · ชนิด: {t.dataType}</span>
            <em>{String(t.value)}</em>
            <i style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>พร้อมใช้งาน</i>
          </div>
        ))}
      </section>
    </main>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('gateway-theme') || 'dark');
  const isDark = theme === 'dark';

  const [page, setPage] = useState('builder');
  const [dashName, setDashName] = useState('Factory Line 01 Overview');
  const [tagDefs, setTagDefs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gateway-plc-tags')) || initialTagDefs;
    } catch {
      return initialTagDefs;
    }
  });
  const [history, setHistory] = useState({});
  const [activeSource, setActiveSource] = useState('ยังไม่ได้เชื่อมต่อข้อมูล (รอการซิงก์ CSV / Database)');

  // สร้างฟอร์มเพิ่ม PLC Tag ใหม่พร้อม Address และ Data Type
  const [newKey, setNewKey] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newDataType, setNewDataType] = useState('REAL');
  const [newDesc, setNewDesc] = useState('');

  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gateway-dashboard-designer')) || defaultPanels;
    } catch {
      return defaultPanels;
    }
  });
  const [selected, setSelected] = useState('oee');
  const [previewMode, setPreviewMode] = useState(false);
  const [notice, setNotice] = useState('');
  const [uploadTargetId, setUploadTargetId] = useState(null);
  const fileInputRef = useRef(null);
  const pngInputRef = useRef(null);

  // แปลง tagDefs เป็น object { key: value } สำหรับการแสดงผลบน Panel
  const tags = tagDefs.reduce((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});

  const current = items.find(x => x.id === selected);

  useEffect(() => {
    localStorage.setItem('gateway-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('gateway-plc-tags', JSON.stringify(tagDefs));
  }, [tagDefs]);

  const showNotice = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 2500);
  };

  const update = (key, val) => setItems(all => all.map(p => p.id === selected ? { ...p, [key]: val } : p));

  const triggerPngUpload = (panelId) => {
    setUploadTargetId(panelId);
    pngInputRef.current?.click();
  };

  const handlePngFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const target = uploadTargetId || selected;
      setItems(all => all.map(p => p.id === target ? { ...p, imgSrc: ev.target.result, title: p.title === 'โมเดลเครื่องจักร / Robot' ? file.name.replace(/\.[^/.]+$/, '') : p.title } : p));
      showNotice(`อัปโหลดรูป "${file.name}" สำเร็จ ✓`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const add = (type) => {
    const labelMap = {
      stat: 'กล่องตัวเลขใหม่',
      gauge: 'เกจวัดค่าใหม่',
      trend: 'กราฟเส้นใหม่',
      machine: 'โมเดลเครื่องจักร / Robot',
      table: 'ตารางข้อมูลใหม่',
      alarms: 'กล่องแจ้งเตือนใหม่'
    };
    const newId = type + '-' + Date.now();
    const item = {
      id: newId,
      type,
      title: labelMap[type] || 'Panel ใหม่',
      desc: '',
      tag: type === 'machine' ? 'run' : (type === 'gauge' ? 'temp' : 'count'),
      unit: type === 'gauge' ? ' °C' : '',
      color: 'blue',
      min: 0,
      max: 100,
      decimals: 1,
      warn: 80,
      crit: 95,
      span: type === 'trend' ? 2 : 1
    };
    setItems(x => [...x, item]);
    setSelected(newId);
    if (type === 'machine') {
      setUploadTargetId(newId);
      if (pngInputRef.current) {
        pngInputRef.current.value = "";
        pngInputRef.current.click();
      }
    }
  };

  const duplicatePanel = () => {
    if (!current) return;
    const copy = { ...current, id: current.type + '-' + Date.now(), title: current.title + ' (Copy)' };
    setItems(x => [...x, copy]);
    setSelected(copy.id);
    showNotice('คัดลอกกล่องข้อมูลแล้ว');
  };

  const saveLocal = () => {
    localStorage.setItem('gateway-dashboard-designer', JSON.stringify(items));
    localStorage.setItem('gateway-plc-tags', JSON.stringify(tagDefs));
    showNotice('บันทึกแบบร่างลงเครื่องแล้ว ✓');
  };

  const resetTemplate = () => {
    setItems(defaultPanels);
    setSelected('oee');
    localStorage.setItem('gateway-dashboard-designer', JSON.stringify(defaultPanels));
    showNotice('รีเซ็ตกลับเป็นเทมเพลตเริ่มต้นแล้ว');
  };

  const exportJson = () => {
    const payload = {
      schemaVersion: '1.0',
      generator: 'GatewayOS Dashboard Designer',
      theme,
      dataSource: activeSource,
      exportedAt: new Date().toISOString(),
      plcTagTable: tagDefs,
      dashboard: {
        title: dashName,
        panels: items
      }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dashName.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('ส่งออกไฟล์ Dashboard (.json) สำเร็จ ✓');
  };

  const importJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const loadedPanels = parsed.dashboard?.panels || parsed.panels;
        if (Array.isArray(loadedPanels)) {
          setItems(loadedPanels);
          if (parsed.dashboard?.title) setDashName(parsed.dashboard.title);
          if (Array.isArray(parsed.plcTagTable)) setTagDefs(parsed.plcTagTable);
          setSelected(loadedPanels[0]?.id || '');
          showNotice(`นำเข้าไฟล์ "${file.name}" สำเร็จ ✓`);
        } else {
          showNotice('รูปแบบไฟล์ JSON ไม่ถูกต้อง');
        }
      } catch {
        showNotice('ไม่สามารถอ่านไฟล์ JSON ได้');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const addPlcTag = (e) => {
    e.preventDefault();
    const k = newKey.trim();
    if (!k) return;
    if (tagDefs.some(t => t.key === k)) {
      showNotice(`มีชื่อ Tag "${k}" อยู่ในตารางแล้ว`);
      return;
    }
    const defaultVal = newDataType === 'BOOL' ? false : 0;
    setTagDefs(prev => [
      ...prev,
      {
        key: k,
        address: newAddress.trim() || 'D200',
        dataType: newDataType,
        value: defaultVal,
        desc: newDesc.trim() || 'ตัวแปรจาก PLC Ladder'
      }
    ]);
    setNewKey('');
    setNewAddress('');
    setNewDesc('');
    showNotice(`เพิ่ม PLC Tag "${k}" ลงตารางแล้ว ✓`);
  };

  const deletePlcTag = (key) => {
    setTagDefs(prev => prev.filter(t => t.key !== key));
    showNotice(`ลบ PLC Tag "${key}" ออกแล้ว`);
  };

  const updateTagField = (key, field, val) => {
    setTagDefs(prev => prev.map(t => t.key === key ? { ...t, [field]: val } : t));
    if (field === 'value') {
      if (typeof val === 'number') {
        setHistory(h => ({ ...h, [key]: [...(h[key] || []), val] }));
      }
      setActiveSource('Manual PLC Tag Write (ป้อนค่าทดสอบ)');
    }
  };

  const handleSyncData = (latestRowObj, newHist, sourceLabel) => {
    setTagDefs(prev => {
      const updated = prev.map(t => latestRowObj[t.key] !== undefined ? { ...t, value: latestRowObj[t.key] } : t);
      Object.entries(latestRowObj).forEach(([k, v]) => {
        if (!updated.some(t => t.key === k)) {
          updated.push({
            key: k,
            address: 'DB_SYNC',
            dataType: typeof v === 'boolean' ? 'BOOL' : (Number.isInteger(v) ? 'INT' : 'REAL'),
            value: v,
            desc: 'นำเข้าอัตโนมัติจากแหล่งข้อมูล'
          });
        }
      });
      return updated;
    });
    setHistory(prev => ({ ...prev, ...newHist }));
    setActiveSource(sourceLabel);
  };

  const sectionHeaderStyle = {
    fontSize: '10px',
    fontWeight: 700,
    color: isDark ? '#94a3b8' : '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: `1px solid ${isDark ? '#26303d' : '#cbd5e1'}`,
    paddingBottom: '4px',
    marginTop: '10px',
    marginBottom: '6px'
  };

  return (
    <div
      className="gateway"
      style={{
        gridTemplateColumns: previewMode ? '1fr' : (page === 'builder' ? '56px 1fr 295px' : '56px 1fr'),
        background: isDark ? '#0b0e14' : '#f1f5f9',
        color: isDark ? '#e2e8f0' : '#0f172a'
      }}
    >
      {!isDark && (
        <style>{`
          .topbar, .sidebar, .inspector, .status { background: #ffffff !important; border-color: #cbd5e1 !important; color: #0f172a !important; }
          .topbar button, .dash-tools button.secondary, .add-menu button { background: #f8fafc !important; border-color: #cbd5e1 !important; color: #1e293b !important; }
          .sidebar button { color: #475569 !important; }
          .sidebar button.active { background: #fff7ed !important; color: #ea580c !important; }
          .inspector input, .inspector select, .connect-form input, .connect-form select { background: #f8fafc !important; border-color: #cbd5e1 !important; color: #0f172a !important; }
          .mini-table > div { border-color: #e2e8f0 !important; }
        `}</style>
      )}

      <header className="topbar">
        <div className="wordmark" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <a
            href="/home.html"
            style={{
              display: "inline-flex", alignItems: "center", gap: "4px",
              background: isDark ? "rgba(234, 88, 12, 0.15)" : "#fff7ed",
              border: "1px solid #ea580c", color: "#ea580c",
              padding: "4px 10px", borderRadius: "6px", fontSize: "12px",
              fontWeight: 700, cursor: "pointer", textDecoration: "none", marginRight: "4px"
            }}
            title="กลับไปหน้าแรก"
          >
            <ArrowLeft size={14} /> หน้าแรก
          </a>
          
          <span>G</span><b>GatewayOS</b>
          <small style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginLeft: '6px' }}>Dashboard Designer</small>
        </div>

        <input
          value={dashName}
          onChange={e => setDashName(e.target.value)}
          className="workspace"
          style={{
            width: '230px',
            textAlign: 'left',
            cursor: 'text',
            background: isDark ? '#161b22' : '#f8fafc',
            color: isDark ? '#f1f5f9' : '#0f172a',
            border: `1px solid ${isDark ? '#30363d' : '#cbd5e1'}`,
            borderRadius: '6px',
            padding: '5px 10px',
            fontSize: '13px',
            fontWeight: 600
          }}
          title="คลิกเพื่อเปลี่ยนชื่อ Dashboard"
        />

        <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {notice && <span style={{ fontSize: '12px', color: '#22c55e', marginRight: '6px', fontWeight: 600, whiteSpace: 'nowrap' }}>{notice}</span>}

          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}
            title="สลับโหมดสีหน้าจอ (Dark / Light Mode)"
          >
            {isDark ? <><Sun size={14} color="#fbbf24" /> Light</> : <><Moon size={14} color="#334155" /> Dark</>}
          </button>

          <button onClick={() => setPreviewMode(!previewMode)} style={{ whiteSpace: 'nowrap' }} title="สลับโหมดดูตัวอย่างเต็มจอ (Kiosk Preview)">
            {previewMode ? <><EyeOff size={15} /> ออกจาก Preview</> : <><Eye size={15} /> Preview</>}
          </button>

          <button onClick={() => fileInputRef.current?.click()} style={{ whiteSpace: 'nowrap' }} title="นำเข้าไฟล์ Dashboard (.json)">
            <Upload size={15} /> Import JSON
          </button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={importJson} />
          <input ref={pngInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style={{ display: 'none' }} onChange={handlePngFile} />

          <button onClick={exportJson} style={{ background: '#0284c7', borderColor: '#0284c7', color: '#fff', whiteSpace: 'nowrap' }} title="ส่งออกเป็นไฟล์ Dashboard (.json) แบบ Grafana">
            <Download size={15} /> Export JSON
          </button>

          <button onClick={saveLocal} style={{ whiteSpace: 'nowrap' }}>
            <Save size={15} /> บันทึก
          </button>
        </div>
      </header>

      {!previewMode && (
        <aside className="sidebar">
          <nav>
            <button className={page === 'builder' ? 'active' : ''} onClick={() => setPage('builder')} title="ออกแบบ Dashboard">
              <LayoutDashboard />
            </button>
            <button className={page === 'datasources' ? 'active' : ''} onClick={() => setPage('datasources')} title="เชื่อมต่อ Google Sheets / Database">
              <Database />
            </button>
            <button className={page === 'tags' ? 'active' : ''} onClick={() => setPage('tags')} title="ตารางตัวแปร PLC (PLC Tag Mapping)">
              <Tag />
            </button>
          </nav>
        </aside>
      )}

      {page === 'datasources' && !previewMode ? (
        <DataSourcesPage
          tagDefs={tagDefs}
          onSyncData={handleSyncData}
          activeSource={activeSource}
          setActiveSource={setActiveSource}
          showNotice={showNotice}
          isDark={isDark}
        />
      ) : page === 'tags' && !previewMode ? (
        <main className="settings-page" style={{ color: isDark ? undefined : '#0f172a' }}>
          <h1>ตารางผูกตัวแปร PLC (PLC Tag Table &amp; Address Mapping)</h1>
          <p style={{ color: isDark ? undefined : '#475569' }}>
            กำหนดชื่อ Tag ให้ตรงกับที่เขียนในโปรแกรม PLC Ladder พร้อมระบุ PLC Address / Register เพื่อนำไปเลือกผูกใน Panel Options ของ Dashboard
          </p>

          <section className="connect-card" style={isDark ? undefined : { background: '#ffffff', borderColor: '#cbd5e1' }}>
            <div className="connect-icon"><Tag /></div>
            <div>
              <h2>เพิ่มตัวแปรจาก PLC Ladder (Add PLC Tag)</h2>
              <p>ตั้งชื่อ Tag, Address (เช่น <code>D100</code>, <code>%IW64</code>, <code>M0.0</code>) และชนิดข้อมูล</p>
            </div>
            <span className="badge" style={{ whiteSpace: 'nowrap' }}>PLC TAGS</span>
            <form className="connect-form wide" onSubmit={addPlcTag} style={{ flexWrap: 'wrap' }}>
              <label>ชื่อตัวแปร (Tag Name)
                <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="เช่น motor_rpm, pressure" />
              </label>
              <label>PLC Address / Register
                <input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="เช่น D108 / %MW12" />
              </label>
              <label>ชนิดข้อมูล (Data Type)
                <select value={newDataType} onChange={e => setNewDataType(e.target.value)}>
                  <option value="BOOL">BOOL (Bit / Coil)</option>
                  <option value="INT">INT (16-bit Word)</option>
                  <option value="REAL">REAL (Float 32-bit)</option>
                </select>
              </label>
              <label style={{ flex: 1, minWidth: '160px' }}>คำอธิบาย (Comment)
                <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="เช่น ความเร็วมอเตอร์สายพาน" />
              </label>
              <button type="submit" style={{ whiteSpace: 'nowrap' }}>เพิ่ม PLC Tag</button>
            </form>
          </section>

          <section className="tag-preview" style={isDark ? undefined : { background: '#ffffff', borderColor: '#cbd5e1' }}>
            <h2>ตาราง PLC Tags ทั้งหมด ({tagDefs.length} Tags) — กด "ไปหน้าออกแบบ" เพื่อผูกกับกล่องกราฟ</h2>
            {tagDefs.map(t => (
              <div
                key={t.key}
                style={{
                  borderBottomColor: isDark ? undefined : '#e2e8f0',
                  display: 'grid',
                  gridTemplateColumns: '20px 135px 140px 65px 1fr 115px 95px 38px',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <Tag size={14} />
                <b>{t.key}</b>
                <input
                  value={t.address}
                  onChange={e => updateTagField(t.key, 'address', e.target.value)}
                  style={{ padding: '4px 8px', background: isDark ? '#0f172a' : '#f8fafc', color: '#fb923c', border: '1px solid #334155', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }}
                  title="แก้ไข PLC Address"
                />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>{t.dataType}</span>
                <span style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.desc}</span>
                {t.dataType === 'BOOL' ? (
                  <select
                    value={String(t.value)}
                    onChange={e => updateTagField(t.key, 'value', e.target.value === 'true')}
                    style={{ padding: '4px 6px', background: isDark ? '#0f172a' : '#f8fafc', color: isDark ? '#fff' : '#0f172a', border: '1px solid #334155', borderRadius: '4px', fontSize: '12px' }}
                  >
                    <option value="false">false (OFF)</option>
                    <option value="true">true (ON)</option>
                  </select>
                ) : (
                  <input
                    type="number"
                    step="any"
                    value={t.value}
                    onChange={e => updateTagField(t.key, 'value', Number(e.target.value))}
                    style={{ width: '100%', padding: '4px 8px', background: isDark ? '#0f172a' : '#f8fafc', color: '#38bdf8', border: '1px solid #334155', borderRadius: '4px', fontWeight: 700, boxSizing: 'border-box' }}
                    title="ค่าปัจจุบัน (ทดลองป้อนค่าเพื่อดูผลบน Dashboard)"
                  />
                )}
                <i style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>พร้อมผูกกราฟ</i>
                <button
                  type="button"
                  onClick={() => deletePlcTag(t.key)}
                  title={`ลบ Tag ${t.key}`}
                  style={{ background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', borderRadius: '5px', padding: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </section>
        </main>
      ) : (
        <>
          <main className="workspace-main" style={{ marginLeft: previewMode ? 0 : undefined, paddingBottom: '48px' }}>
            <div className="dash-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div className="crumb">Dashboard Designer / {dashName}</div>
                <h1 style={{ margin: '2px 0 0' }}>{dashName}</h1>
              </div>
              {!previewMode && (
                <div className="dash-tools" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button className="secondary" onClick={() => setPage('tags')} style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', fontSize: '12px' }}>
                    <Tag size={14} /> ตั้งค่า PLC Tags
                  </button>
                  <button className="secondary" onClick={() => setPage('datasources')} style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', fontSize: '12px' }}>
                    <Database size={14} /> เชื่อมตาราง / Database
                  </button>
                  <button className="secondary" onClick={resetTemplate} style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', fontSize: '12px' }}>
                    <RotateCcw size={14} /> รีเซ็ต
                  </button>
                  <button className="primary" onClick={exportJson} style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '12px' }}>
                    <Download size={14} /> Export (.json)
                  </button>
                </div>
              )}
            </div>

            {!previewMode && (
              <div className="builder-row" style={{ flexWrap: 'wrap', gap: '8px' }}>
                <div className="add-menu" style={{ flexWrap: 'wrap' }}>
                  <span>เพิ่มกล่องข้อมูล</span>
                  {types.map(([type, name, Icon]) => (
                    <button
                      key={type}
                      onClick={() => add(type)}
                      style={type === 'machine' ? { background: '#0369a1', borderColor: '#0284c7', color: '#fff' } : undefined}
                    >
                      <Icon size={15} />{name}
                    </button>
                  ))}
                </div>
                <span className="hint">คลิกเลือกกล่องเพื่อผูก PLC Tag ทางขวา</span>
              </div>
            )}

            <section className="dash-grid">
              {items.map(p => (
                <DashboardPanel
                  key={p.id}
                  panel={p}
                  tags={tags}
                  tagDefs={tagDefs}
                  history={history}
                  selected={p.id === selected}
                  onSelect={() => setSelected(p.id)}
                  previewMode={previewMode}
                  onUploadImage={triggerPngUpload}
                  isDark={isDark}
                />
              ))}
            </section>
          </main>

          {!previewMode && (
            <aside className="inspector" style={{ overflowY: 'auto', paddingBottom: '56px' }}>
              <div className="inspector-head"><Sliders size={14} style={{ marginRight: 6 }} /> Panel Options (Grafana)</div>
              {current ? (
                <>
                  <div style={sectionHeaderStyle}>1. ข้อมูลทั่วไป (Panel Options)</div>
                  <label>ชื่อหัวข้อ (Title)
                    <input value={current.title} onChange={e => update('title', e.target.value)} />
                  </label>
                  <label>คำอธิบายย่อย (Description)
                    <input value={current.desc || ''} onChange={e => update('desc', e.target.value)} placeholder="คำอธิบายเพิ่มเติมใต้ตัวเลข" />
                  </label>

                  <div style={sectionHeaderStyle}>2. รูปแบบและการแสดงผล (Visualization)</div>
                  <label>ประเภทกราฟ / โมเดล
                    <select value={current.type} onChange={e => update('type', e.target.value)}>
                      {types.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                    </select>
                  </label>

                  {current.type === 'machine' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                      <button
                        type="button"
                        onClick={() => triggerPngUpload(current.id)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: '#0284c7', border: '1px solid #0369a1', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <ImagePlus size={14} /> {current.imgSrc ? 'เปลี่ยนรูปเครื่องจักร / Robot (.PNG)' : 'เลือกไฟล์รูปเครื่องจักร (.PNG)'}
                      </button>
                      {current.imgSrc && (
                        <button
                          type="button"
                          onClick={() => update('imgSrc', '')}
                          style={{ width: '100%', padding: '5px 8px', borderRadius: '5px', background: 'transparent', border: '1px solid #475569', color: '#94a3b8', fontSize: '11px', cursor: 'pointer' }}
                        >
                          ล้างรูปภาพออก
                        </button>
                      )}
                    </div>
                  )}

                  <div style={sectionHeaderStyle}>3. การผูกตัวแปร PLC (Data Query / Tag)</div>
                  <label>เลือก PLC Tag (จากตาราง Ladder)
                    <select value={current.tag} onChange={e => update('tag', e.target.value)}>
                      {tagDefs.map(t => (
                        <option key={t.key} value={t.key}>{t.key} ({t.address} · {t.dataType})</option>
                      ))}
                      <option value="oee">oee (คำนวณจากสถานะ run)</option>
                      <option value="all">all tags (แสดงทั้งหมด)</option>
                    </select>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <label>หน่วยวัด (Unit)
                      <input value={current.unit || ''} onChange={e => update('unit', e.target.value)} placeholder="°C, kW, %" />
                    </label>
                    <label>ทศนิยม (Decimals)
                      <input type="number" min="0" max="4" value={current.decimals ?? 1} onChange={e => update('decimals', Number(e.target.value))} />
                    </label>
                  </div>

                  {current.type !== 'machine' && current.type !== 'table' && current.type !== 'alarms' && (
                    <>
                      <div style={sectionHeaderStyle}>4. ขอบเขตและเกณฑ์สี (Thresholds)</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <label>ค่าต่ำสุด (Min)
                          <input type="number" value={current.min ?? 0} onChange={e => update('min', Number(e.target.value))} />
                        </label>
                        <label>ค่าสูงสุด (Max)
                          <input type="number" value={current.max ?? 100} onChange={e => update('max', Number(e.target.value))} />
                        </label>
                        <label>เตือนสีส้ม (Warn ≥)
                          <input type="number" value={current.warn ?? ''} onChange={e => update('warn', e.target.value === '' ? '' : Number(e.target.value))} />
                        </label>
                        <label>วิกฤตสีแดง (Crit ≥)
                          <input type="number" value={current.crit ?? ''} onChange={e => update('crit', e.target.value === '' ? '' : Number(e.target.value))} />
                        </label>
                      </div>
                      <label>สีปกติ (Base Color)
                        <select value={current.color || 'blue'} onChange={e => update('color', e.target.value)}>
                          <option value="green">เขียว (Green)</option>
                          <option value="blue">ฟ้า (Blue)</option>
                          <option value="orange">ส้ม (Orange)</option>
                          <option value="yellow">เหลือง (Yellow)</option>
                          <option value="red">แดง (Red)</option>
                        </select>
                      </label>
                    </>
                  )}

                  <div style={sectionHeaderStyle}>5. ขนาดและการจัดการ (Layout)</div>
                  <label>ความกว้างกล่อง (Grid Span)
                    <select value={current.span || 1} onChange={e => update('span', Number(e.target.value))}>
                      <option value={1}>1 คอลัมน์ (ปกติ)</option>
                      <option value={2}>2 คอลัมน์ (ขยายกว้างเต็มแถว)</option>
                    </select>
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px', paddingTop: '12px', borderTop: `1px solid ${isDark ? '#26303d' : '#cbd5e1'}` }}>
                    <button
                      type="button"
                      onClick={duplicatePanel}
                      style={{ position: 'static', margin: 0, padding: '8px 10px', borderRadius: '6px', background: isDark ? '#1e293b' : '#f1f5f9', border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`, color: isDark ? '#e2e8f0' : '#0f172a', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                    >
                      <Copy size={13} /> ทำซ้ำ
                    </button>
                    <button
                      type="button"
                      onClick={() => setItems(x => x.filter(p => p.id !== selected))}
                      style={{ position: 'static', margin: 0, padding: '8px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                    >
                      <Trash2 size={13} /> ลบกล่อง
                    </button>
                  </div>
                </>
              ) : <p style={{ fontSize: '12px', color: '#94a3b8' }}>คลิกที่กล่องข้อมูลบนหน้าจอเพื่อตั้งค่า</p>}
            </aside>
          )}
        </>
      )}

      <footer className="status" style={{ left: previewMode ? 0 : undefined }}>
        <span><i /> Data Source: {activeSource}</span>
        <span>ธีม: {isDark ? 'Dark Mode' : 'Light Mode'} · {items.length} Panels · {tagDefs.length} PLC Tags</span>
      </footer>
    </div>
  );
}
