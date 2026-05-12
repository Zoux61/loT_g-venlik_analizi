import { useEffect, useState, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import './App.css'

function App() {
  // BAĞIMSIZ DEPOLAR
  const [allPackets, setAllPackets] = useState([])
  const [iotPackets, setIotPackets] = useState([])
  const [riskyPackets, setRiskyPackets] = useState([])
  const [blockedPackets, setBlockedPackets] = useState([])

  const [stats, setStats] = useState({ total: 0, risky: 0, iot: 0, blocked: 0 })
  const [connectionStatus, setConnectionStatus] = useState('Sinyal Bekleniyor...')
  const [isPaused, setIsPaused] = useState(false)
  const [blackList, setBlackList] = useState([])
  const [filterMode, setFilterMode] = useState('all')

  const isPausedRef = useRef(isPaused)
  const blackListRef = useRef(blackList)
  const scrollRef = useRef(null)
  const packetBufferRef = useRef([])

  useEffect(() => {
    isPausedRef.current = isPaused
    blackListRef.current = blackList
  }, [isPaused, blackList])

  // 🛠️ PROTOKOL KISALTMA FONKSİYONU: Tabloyu dağıtan uzun zincirleri budar
  const formatProtocol = (proto) => {
    if (!proto) return "UNKNOWN";
    const parts = proto.split(':');
    // Eğer zincir 5'ten fazlaysa, son 4 katmanı gösterir
    if (parts.length > 5) {
      return "..." + parts.slice(-4).join(':');
    }
    return proto;
  };

  // OTOMATİK KAYDIRMA
  useEffect(() => {
    if (scrollRef.current && !isPaused && (filterMode === 'all' || filterMode === 'iot')) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [allPackets, iotPackets, filterMode])

  useEffect(() => {
    let isMounted = true
    const localUrl = 'http://localhost:5000/iotHub'
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(localUrl, { skipNegotiation: true, transport: signalR.HttpTransportType.WebSockets })
      .withAutomaticReconnect()
      .build()

    newConnection.start().then(() => {
      if (!isMounted) return
      setConnectionStatus('Analiz Aktif 🟢')
      
      newConnection.on('ReceivePacket', (data) => {
        if (isPausedRef.current) return
        const parts = data.split(';').map((p) => p.trim())

        if (parts.length >= 4) {
          const srcIp = parts[1] || 'Yerel'
          const dstIp = parts[2] || 'Yayın'
          const protocol = (parts[3] || 'UNKNOWN').toUpperCase()

          if (blackListRef.current.includes(srcIp)) return

          const iotProtocols = ['MQTT', 'MDNS', 'SSDP', 'COAP', 'LLMNR', 'IGMP']
          const isIot = iotProtocols.some((p) => protocol.includes(p)) || dstIp.startsWith('224.')

          let risk = 'Güvenli'
          let riskColor = '#4ade80'
          let alertMsg = isIot ? 'Güvenli IoT' : 'Standart Akış'
          let isHighRisk = false

          const badProtocols = ['HTTP', 'TELNET', 'FTP']
          if (badProtocols.some((p) => protocol.includes(p))) {
            risk = 'YÜKSEK'
            riskColor = '#f87171'
            alertMsg = 'Şifresiz Veri (Zafiyet)!'
            isHighRisk = true
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
            isBlocked: false,
          }
          packetBufferRef.current.push(newPacket)
        }
      })
    }).catch(() => {
      if (isMounted) setConnectionStatus('Bağlantı Hatası 🔴')
    })

    const interval = setInterval(() => {
      if (packetBufferRef.current.length > 0) {
        const itemsToProcess = [...packetBufferRef.current]
        packetBufferRef.current = []

        setAllPackets((prev) => [...prev, ...itemsToProcess].slice(-150))
        const incomingIot = itemsToProcess.filter((p) => p.isIot)
        if (incomingIot.length > 0) setIotPackets((prev) => [...prev, ...incomingIot].slice(-100))
        const incomingRisky = itemsToProcess.filter((p) => p.risk === 'YÜKSEK')
        if (incomingRisky.length > 0) setRiskyPackets((prev) => [...prev, ...incomingRisky].slice(-100))

        setStats((s) => ({
          ...s,
          total: s.total + itemsToProcess.length,
          risky: s.risky + incomingRisky.length,
          iot: s.iot + incomingIot.length,
        }))
      }
    }, 400)

    return () => {
      isMounted = false
      clearInterval(interval)
      newConnection.stop()
    }
  }, [])

  const blockDevice = (ip) => {
    if (blackList.includes(ip)) return
    setBlackList((prev) => [...prev, ip])
    setStats((s) => ({ ...s, blocked: s.blocked + 1 }))
    const foundPacket = allPackets.find((p) => p.srcIp === ip) || iotPackets.find((p) => p.srcIp === ip) || riskyPackets.find((p) => p.srcIp === ip)
    const blockedItem = foundPacket 
      ? { ...foundPacket, isBlocked: true, alertMsg: 'Erişim Engellendi (Kara Liste)' }
      : { id: Date.now(), time: new Date().toLocaleTimeString(), srcIp: ip, protocol: 'ENGEL', riskColor: '#f59e0b', alertMsg: 'Erişim Engellendi (Kara Liste)', isIot: false, isBlocked: true }
    setBlockedPackets((prev) => [...prev, blockedItem])
  }

  let displayedPackets = []
  if (filterMode === 'all') displayedPackets = allPackets.filter((p) => !blackList.includes(p.srcIp))
  else if (filterMode === 'risky') displayedPackets = riskyPackets.filter((p) => !blackList.includes(p.srcIp))
  else if (filterMode === 'iot') displayedPackets = iotPackets.filter((p) => !blackList.includes(p.srcIp))
  else if (filterMode === 'blocked') displayedPackets = blockedPackets

  return (
    <div style={{ boxSizing: 'border-box', padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#0f172a', color: '#f1f5f9', height: '100vh', width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      
      {/* ÜST PANEL */}
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
          <button onClick={() => { packetBufferRef.current = []; setAllPackets([]); setIotPackets([]); setRiskyPackets([]); setBlockedPackets([]); setStats({ total: 0, risky: 0, iot: 0, blocked: 0 }); setBlackList([]); setFilterMode('all') }} style={{ padding: '8px 15px', borderRadius: '8px', border: '1px solid #444', backgroundColor: 'transparent', color: '#64748b', cursor: 'pointer' }}>
            TEMİZLE
          </button>
        </div>
        <span style={{ fontSize: '12px', color: '#64748b' }}>MOD: {filterMode.toUpperCase()} | {connectionStatus}</span>
      </div>

      {/* VERİ TABLOSU */}
      <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}>
        {displayedPackets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b', fontSize: '14px' }}>
            Bu kategoriye ait paket bekleniyor / bulunamadı 📭
          </div>
        ) : (
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
              {displayedPackets.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #334155', backgroundColor: p.isBlocked ? '#334155' : 'transparent' }}>
                  <td style={{ padding: '10px', color: p.isBlocked ? '#94a3b8' : '#3b82f6' }}>
                    {p.srcIp} {p.isBlocked && '🚫'}
                  </td>
                  {/* PROTOKOL HÜCRESİ DÜZENLENDİ */}
                  <td title={p.protocol}> 
                    <span style={{ 
                      backgroundColor: '#0f172a', padding: '3px 6px', borderRadius: '4px', 
                      color: p.isBlocked ? '#64748b' : '#f1f5f9',
                      display: 'inline-block', maxWidth: '200px', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'help'
                    }}>
                      {formatProtocol(p.protocol)}
                    </span>
                  </td>
                  <td style={{ color: p.isBlocked ? '#64748b' : (p.isIot ? '#10b981' : '#94a3b8') }}>
                    {p.isIot ? '📡 IoT Cihazı' : '🖥️ Genel'}
                  </td>
                  <td style={{ color: p.isBlocked ? '#f59e0b' : p.riskColor, fontWeight: 'bold' }}>
                    {p.alertMsg}
                  </td>
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
        )}
      </div>
    </div>
  )
}

export default App;