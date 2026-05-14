# 🛡️ IoT Security Analyzer & IPS

Yerel ağlarda (LAN) çalışan Akıllı Cihazların (IoT) ve standart istemcilerin veri trafiğini gerçek zamanlı olarak izleyen, Derin Paket İnceleme (DPI) algoritmalarıyla zafiyetleri tespit eden ve zararlı kaynakları aktif olarak izole eden yazılım tabanlı bir **Saldırı Tespit ve Önleme Sistemi (IDS/IPS)** prototipidir.

## 🚀 Özellikler

- **Gerçek Zamanlı Trafik Koklama (Sniffing):** Ağ kartı üzerinden geçen ham paketleri asenkron olarak yakalar.
- **Derin Paket İnceleme (DPI):** Paketlerin sadece başlık bilgilerini değil, katmanlı protokol zincirlerini analiz eder.
- **Şifresiz Veri (Cleartext) Zafiyet Tespiti:** Ağda şifrelenmeden iletilen `HTTP`, `FTP`, `TELNET` gibi güvensiz akışları anında "Yüksek Risk" olarak işaretler.
- **Karakteristik IoT Sınıflandırması:** `MQTT`, `mDNS`, `SSDP`, `CoAP` gibi protokollere bakarak cihazları standart bilgisayar trafiğinden otomatik ayıklar ve profiller.
- **Aktif İzolasyon (IPS Modu):** Şüpheli kaynak IP adreslerini dinamik kara listeye alarak ağ akışından mantıksal olarak düşürür (Packet Drop).
- **Yüksek Performanslı Arayüz (Batching):** Saniyede binlerce paketin arayüzü dondurmasını engellemek için 400ms'lik optimize edilmiş toplu güncelleme tamponu kullanır.

---

## 🛠️ Sistem Mimarisi ve Teknolojiler

Proje, asenkron ve çift yönlü iletişim kuran iki ana katmandan oluşmaktadır:

- **Backend (Veri Yakalama Motoru):** C# / .NET 8.0
- **Paket Analiz Çekirdeği:** Wireshark (Tshark CLI) & Npcap Sürücüsü
- **Gerçek Zamanlı İletişim:** SignalR (WebSockets)
- **Frontend (Kullanıcı Arayüzü):** React.js & Vite

---

## 📋 Gereksinimler

Sistemin çalışabilmesi için hedef makinede aşağıdaki altyapıların kurulu olması şarttır:

1. **[.NET SDK 8.0+](https://dotnet.microsoft.com/download):** Backend sunucusunu derleyip çalıştırmak için.
2. **[Node.js](https://nodejs.org/):** React arayüzü ve paket yönetimi için.
3. **[Wireshark](https://www.wireshark.org/):** Varsayılan dizine (`C:\Program Files\Wireshark\`) tam kurulu olmalıdır.
4. **Npcap Sürücüsü:** Wireshark kurulumu sırasında ağ kartını derinlemesine dinleme izni veren **Npcap** bileşeni mutlaka yüklenmelidir.

---

## ⚙️ Kurulum ve Çalıştırma

### 1. Ağ Kartı Yapılandırması
Sistemin doğru fiziksel ağ kartını dinlemesi için terminalde aşağıdaki komutu çalıştırın:
```bash
"C:\Program Files\Wireshark\tshark.exe" -D
