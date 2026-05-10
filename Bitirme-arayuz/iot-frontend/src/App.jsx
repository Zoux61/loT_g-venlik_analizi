import { useEffect, useState, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import './App.css'

function App() {
  const [packets, setPackets] = useState([])
  const [stats, setStats] = useState({ total: 0, risky: 0, iot: 0, blocked: 0 })
  const [connectionStatus, setConnectionStatus] = useState('Sinyal Bekleniyor...')
  const [isPaused, setIsPaused] = useState(false)
  const [blackList, setBlackList] = useState([])
  
  // FİLTRELEME MODLARI: 'all', 'risky', 'iot', 'blocked'
  const [filterMode, setFilterMode] = useState('all');

  const isPausedRef = useRef(isPaused)
  const blackListRef = useRef(blackList)
  const scrollRef = useRef(null)

  useEffect(() => { 
    isPausedRef.current = isPaused;
    blackListRef.current = blackList;
  }, [isPaused, blackList])

  // OTOMATİK KAYDIRMA
  useEffect(() => {
    if (scrollRef.current && !isPaused && (filterMode === 'all' || filterMode === 'iot')) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [packets, filterMode]);

  useEffect(() => {
    const localUrl = "http://localhost:5000/iotHub";
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(localUrl, { skipNegotiation: true, transport: signalR.HttpTransportType.WebSockets })
      .withAutomaticReconnect().build();

    newConnection.start().then(() => {
      setConnectionStatus('Analiz Aktif 🟢');
      newConnection.on("ReceivePacket", (data) => {
        if (isPausedRef.current) return;
        const parts = data.split(';').map(p => p.trim());
        
        if (parts.length >= 4) {
          const srcIp = parts[1] || "Yerel";
          const dstIp = parts[2] || "Yayın";
          const protocol = (parts[3] || "UNKNOWN").toUpperCase();

          if (blackListRef.current.includes(srcIp)) return;

          // 🎯 HASSAS IoT TESPİTİ (GÜRÜLTÜDEN ARINDIRILDI)
          // Genel UDP ve ARP'yi çıkardık. Sadece gerçek akıllı cihaz/keşif protokolleri:
          const iotProtocols = ['MQTT', 'MDNS', 'SSDP', 'COAP', 'LLMNR', 'IGMP'];
          
          // Normal PC internet trafiği (TCP, TLS, HTTP) kesinlikle IoT sayılmasın
          const isGeneralPcTraffic = ['TCP', 'TLS', 'QUIC'].some(p => protocol.includes(p));
          
          // Eğer genel PC trafiği değilse ve IoT listesindeyse (veya multicast adresiyse) IoT say
          const isIot = !isGeneralPcTraffic && (iotProtocols.some(p => protocol.includes(p)) || dstIp.startsWith('224.'));

          // 🔍 GÜVENLİK ANALİZİ
          let risk = "Güvenli";
          let riskColor = "#4ade80";
          let alertMsg = isIot ? "Güvenli IoT" : "Standart Akış";
          let isHighRisk = false;

          if (['HTTP', 'TELNET', 'FTP'].includes(protocol)) {
              risk = "YÜKSEK";
              riskColor = "#f87171";
              alertMsg = "Şifresiz Veri!";
              isHighRisk = true;
          }

          const newPacket = {
            id: Date.now() + Math.random(),
            time: parts[0],
            srcIp,
            dstIp,
            protocol,
            risk,
            riskColor,
            alertMsg,
            isIot,
            isBlocked: false
          };

          setPackets(prev => [...prev, newPacket].slice(-50));
          
          // SAYAÇLARI BİRBİRİNDEN BAĞIMSIZ ARTIR
          setStats(s => ({
            ...s,
            total: s.total + 1, // Her pakette artar (Hızlı döner)
            risky: isHighRisk ? s.risky + 1 : s.risky,
            iot: isIot ? s.iot + 1 : s.iot // Sadece saf IoT paketinde artar (Seçici döner)
          }));
        }
      });
    }).catch(() => setConnectionStatus('Bağlantı Hatası 🔴'));
  }, []);

  const blockDevice = (ip) => {
    setBlackList(prev => [...prev, ip]);
    setStats(s => ({ ...s, blocked: s.blocked + 1 }));
    setPackets(prev => prev.map(p => p.srcIp === ip ? {...p, isBlocked: true} : p));
  };

  const displayedPackets = packets.filter(p => {
    if (filterMode === 'risky') return p.risk === "YÜKSEK";
    if (filterMode === 'iot') return p.isIot === true;
    if (filterMode === 'blocked') return p.isBlocked === true;
    return true; 
  });

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#0f172a', color: '#f1f5f9', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* ÜST PANEL: TIKLANABİLİR FİLTRE KARTLARI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
        
        <div onClick={() => setFilterMode('all')} style={{ backgroundColor: filterMode === 'all' ? '#1e293b' : '#0f172a', padding: '15px', borderRadius: '10px', border: '2px solid ' + (filterMode === 'all' ? '#3b82f6' : '#334155'), cursor: 'pointer' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>TOPLAM AKIŞ</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{stats.total} Pkt</div>
        </div>

        <div onClick={() => setFilterMode('risky')} style={{ backgroundColor: filterMode === 'risky' ? '#1e293b' : '#0f172a', padding: '15px', borderRadius: '10px', border: '2px solid ' + (filterMode === 'risky' ? '#f87171' : '#334155'), cursor: 'pointer' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>GÜVENLİK RİSKİ</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f87171' }}>{stats.risky} Risk</div>
        </div>

        <div onClick={() => setFilterMode('iot')} style={{ backgroundColor: filterMode === 'iot' ? '#1e293b' : '#0f172a', padding: '15px', borderRadius: '10px', border: '2px solid ' + (filterMode === 'iot' ? '#10b981' : '#334155'), cursor: 'pointer' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>IoT TRAFİĞİ</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>{stats.iot} Cihaz</div>
        </div>

        <div onClick={() => setFilterMode('blocked')} style={{ backgroundColor: filterMode === 'blocked' ? '#1e293b' : '#0f172a', padding: '15px', borderRadius: '10px', border: '2px solid ' + (filterMode === 'blocked' ? '#fbbf24' : '#334155'), cursor: 'pointer' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>ENGEL LİSTESİ</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fbbf24' }}>{stats.blocked} IP</div>
        </div>
      </div>

      <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setIsPaused(!isPaused)} style={{ padding: '8px 15px', borderRadius: '8px', border: 'none', backgroundColor: isPaused ? '#fbbf24' : '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
            {isPaused ? '▶️ DEVAM' : '⏸️ DURDUR'}
          </button>
          <button onClick={() => { setPackets([]); setStats({total:0, risky:0, iot:0, blocked:0}); setFilterMode('all') }} style={{ padding: '8px 15px', borderRadius: '8px', border: '1px solid #444', backgroundColor: 'transparent', color: '#64748b', cursor: 'pointer' }}>
            TEMİZLE
          </button>
        </div>
        <span style={{ fontSize: '12px', color: '#64748b' }}>MOD: {filterMode.toUpperCase()} | {connectionStatus}</span>
      </div>

      {/* VERİ TABLOSU */}
      <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#334155', zIndex: 10 }}>
            <tr style={{ textAlign: 'left' }}>
              <th style={{ padding: '12px' }}>Kaynak</th>
              <th>Protokol</th>
              <th>Cihaz Tipi</th>
              <th>Analiz Raporu</th>
              <th>Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {displayedPackets.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #334155', opacity: p.isBlocked ? 0.3 : 1 }}>
                <td style={{ padding: '10px', color: '#3b82f6' }}>{p.srcIp}</td>
                <td><span style={{ backgroundColor: '#0f172a', padding: '3px 6px', borderRadius: '4px' }}>{p.protocol}</span></td>
                <td style={{ color: p.isIot ? '#10b981' : '#94a3b8' }}>{p.isIot ? '📡 IoT Cihazı' : '🖥️ Genel'}</td>
                <td style={{ color: p.riskColor, fontWeight: 'bold' }}>{p.alertMsg}</td>
                <td>
                  {!p.isBlocked && (
                    <button onClick={() => blockDevice(p.srcIp)} style={{ backgroundColor: 'transparent', color: '#f87171', border: '1px solid #f87171', borderRadius: '5px', padding: '3px 8px', cursor: 'pointer' }}>
                      ENGELLE
                    </button>
                  )}
                </td>
              </tr>
            ))}
            <tr ref={scrollRef}></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;