using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using System.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

// ✅ CORS AYARI: React (5173) portuna tam yetki veriyoruz
builder.Services.AddCors(options => {
    options.AddPolicy("CorsPolicy", policy => {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddSignalR();

var app = builder.Build();

app.UseRouting();
app.UseCors("CorsPolicy");

app.MapHub<IoTHub>("/iotHub");

var hubContext = app.Services.GetRequiredService<IHubContext<IoTHub>>();
_ = Task.Run(() => StartTshark(hubContext));

Console.WriteLine("----------------------------------");
Console.WriteLine("🚀 IoT GÜVENLİK MOTORU ÇALIŞTI");
Console.WriteLine("📡 PORT: 5000 | HUB: /iotHub");
Console.WriteLine("----------------------------------");

app.Run("http://localhost:5000");

public class IoTHub : Hub { }

public static partial class Program
{
    static void StartTshark(IHubContext<IoTHub> hubContext)
    {
        try
        {
            Process tshark = new Process();
            tshark.StartInfo.FileName = @"C:\Program Files\Wireshark\tshark.exe";

            // ⚠️ DİKKAT: -i 4 senin internete bağlı olan kart numaran olmalı!
            tshark.StartInfo.Arguments = "-i 4 -l -T fields -e frame.time -e ip.src -e ip.dst -e frame.protocols -E separator=;";

            tshark.StartInfo.UseShellExecute = false;
            tshark.StartInfo.RedirectStandardOutput = true;
            tshark.StartInfo.CreateNoWindow = true;

            tshark.OutputDataReceived += async (s, e) => {
                if (!string.IsNullOrEmpty(e.Data))
                {
                    // Arka planda verinin aktığını görmen için konsola yazıyoruz
                    Console.WriteLine($"VERI: {e.Data}");
                    await hubContext.Clients.All.SendAsync("ReceivePacket", e.Data);
                }
            };

            tshark.Start();
            tshark.BeginOutputReadLine();
            tshark.WaitForExit();
        }
        catch (Exception ex) { Console.WriteLine("HATA: " + ex.Message); }
    }
}