import http from "http";

export function startKeepAlive() {
  const PORT = process.env.PORT || 3000;

  const server = http.createServer((req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/plain"
    });
    res.end("Bot is alive ✅");
  });

  server.listen(PORT, () => {
    console.log(
      `🌐 Keepalive server running on port ${PORT}`
    );
  });
}
