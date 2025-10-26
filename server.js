import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import cors from "cors";

const app = express();
app.use(cors());
app.get("/", (_, res) => res.send("✅ LaUneTV Chat Server is running"));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- Utilisateurs bannis ---
const bannedUsers = new Set();

// --- Diffuser à tous les clients ---
function broadcast(data) {
  const json = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) client.send(json);
  });
}

// --- Quand un utilisateur se connecte ---
wss.on("connection", (ws) => {
  console.log("🔗 Client connecté");
  
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      // Sécurité basique
      if (!data.user || !data.text) return;

      // Si utilisateur banni
      if (bannedUsers.has(data.userId)) {
        ws.send(JSON.stringify({ system: true, text: "⛔ Vous êtes suspendu du chat." }));
        return;
      }

      // Commandes admin/modo
      if (data.text.startsWith("/ban") && data.role === "administrator") {
        const userId = Number(data.text.split(" ")[1]);
        bannedUsers.add(userId);
        broadcast({ system: true, text: `🚫 L'utilisateur #${userId} a été banni.` });
        return;
      }

      if (data.text.startsWith("/delete") && ["administrator","moderator"].includes(data.role)) {
        const messageId = data.text.split(" ")[1];
        broadcast({ action: "delete", id: messageId });
        return;
      }

      // Message normal
      const messageData = {
        id: Date.now(),
        userId: data.userId,
        user: data.user,
        role: data.role,
        text: data.text,
        time: new Date().toISOString()
      };

      broadcast(messageData);
    } catch (err) {
      console.error("❌ Erreur message:", err);
    }
  });

  ws.on("close", () => console.log("❌ Client déconnecté"));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`🚀 LaUneTV Chat Server running on port ${PORT}`));
