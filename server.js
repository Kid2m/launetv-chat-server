// ===== LaUneTV Chat Server =====
// v4.0 — Historique + Modération + Rôles WP + Persistance mémoire

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = createServer(app);

// === CORS sécurisé ===
const allowedOrigins = [
  "https://launetv.fr",
  "https://www.launetv.fr",
  "http://localhost:3000"
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn("❌ CORS refusé pour :", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST"],
  credentials: true
};

app.use(cors(corsOptions));

// === Serveur Socket.io ===
const io = new Server(server, { cors: corsOptions });

// === Endpoint test Render ===
app.get("/", (req, res) => {
  res.send("✅ LaUneTV Chat Server is running and awake!");
});

// === Données en mémoire (50 derniers messages) ===
let users = {}; // { socket.id: { username, role } }
let messages = [];

// === Connexion client ===
io.on("connection", (socket) => {
  console.log("🔌 Nouveau client connecté :", socket.id);

  // === JOIN ===
  socket.on("join", ({ username, role }) => {
    users[socket.id] = { username, role };
    socket.emit("roleConfirmed", role);
    socket.emit("messageHistory", messages);

    console.log(`👤 ${username} (${role}) a rejoint le chat.`);

    const joinMsg = {
      username: "Système",
      text: `${username} a rejoint le chat.`,
      type: "system",
      time: Date.now()
    };
    io.emit("message", joinMsg);
  });

  // === MESSAGE ===
  socket.on("message", (text) => {
    const user = users[socket.id];
    if (!user) return;

    const msg = {
      username: user.username,
      text,
      type: "user",
      time: Date.now()
    };

    messages.push(msg);
    if (messages.length > 50) messages.shift();

    io.emit("message", msg);
  });

  // === MODÉRATION : KICK ===
  socket.on("kickUser", (target) => {
    const kicker = users[socket.id];
    if (!kicker) return;

    const roleStr = Array.isArray(kicker.role)
      ? kicker.role.join(",")
      : kicker.role.toString().toLowerCase();

    const isAdmin = roleStr.includes("administrator");
    const isModo = roleStr.includes("um_modo");
    if (!isAdmin && !isModo) return;

    const targetId = Object.keys(users).find(
      (id) => users[id].username === target
    );

    if (targetId) {
      io.to(targetId).emit("kicked");
      io.sockets.sockets.get(targetId)?.disconnect(true);
      delete users[targetId];
      console.log(`🚨 ${target} a été exclu par ${kicker.username}`);

      const msg = {
        username: "Système",
        text: `${target} a été exclu du chat.`,
        type: "system",
        time: Date.now()
      };
      io.emit("message", msg);
    }
  });

  // === MODÉRATION : SUPPRESSION ===
  socket.on("deleteMessage", (msgId) => {
    const admin = users[socket.id];
    if (!admin) return;

    const roleStr = Array.isArray(admin.role)
      ? admin.role.join(",")
      : admin.role.toString().toLowerCase();

    const isAdmin = roleStr.includes("administrator");
    const isModo = roleStr.includes("um_modo");
    if (!isAdmin && !isModo) return;

    const index = messages.findIndex((m) => m.time == msgId);
    if (index !== -1) {
      messages.splice(index, 1);
      io.emit("messageDeleted", msgId);
      console.log(`🗑️ Message ${msgId} supprimé par ${admin.username}`);
    }
  });

  // === DÉCONNEXION ===
  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (user) {
      console.log(`❌ ${user.username} s’est déconnecté`);
      const msg = {
        username: "Système",
        text: `${user.username} a quitté le chat.`,
        type: "system",
        time: Date.now()
      };
      io.emit("message", msg);
      delete users[socket.id];
    }
  });
});

// === Démarrage serveur ===
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 LaUneTV Chat Server actif sur le port ${PORT}`);
});
