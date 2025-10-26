// ===== LaUneTV Chat Server =====
// Node.js + Socket.io
// v1.2 - Compatible Render, WordPress & Ultimate Member (roles)

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
const io = new Server(server, {
  cors: corsOptions
});

// === Endpoint test Render ===
app.get("/", (req, res) => {
  res.send("✅ LaUneTV Chat Server is running.");
});

// === Gestion des utilisateurs ===
let users = {}; // { socket.id: { username, role } }

io.on("connection", (socket) => {
  console.log("🔌 Nouveau client connecté :", socket.id);

  // === User rejoint le chat ===
  socket.on("join", ({ username, role }) => {
    users[socket.id] = { username, role };
    console.log(`👤 ${username} (${role}) connecté.`);
    io.emit("userList", Object.values(users));
    io.emit("message", {
      username: "Système",
      text: `${username} a rejoint le chat.`,
      type: "system"
    });
  });

  // === Message standard ===
  socket.on("message", (text) => {
    const user = users[socket.id];
    if (!user) return;
    console.log(`💬 ${user.username}: ${text}`);
    io.emit("message", { username: user.username, text, type: "user" });
  });

  // === Modération : kick d’un utilisateur ===
  socket.on("kickUser", (target) => {
    const kicker = users[socket.id];
    if (kicker?.role !== "um_admin" && kicker?.role !== "um_modo") return;

    const targetId = Object.keys(users).find(
      (id) => users[id].username === target
    );
    if (targetId) {
      io.to(targetId).emit("kicked");
      io.sockets.sockets.get(targetId)?.disconnect(true);
      delete users[targetId];
      console.log(`🚨 ${target} a été exclu par ${kicker.username}`);
      io.emit("userList", Object.values(users));
      io.emit("message", {
        username: "Système",
        text: `${target} a été exclu du chat.`,
        type: "system"
      });
    }
  });

  // === Déconnexion ===
  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (user) {
      console.log(`❌ ${user.username} s’est déconnecté`);
      io.emit("message", {
        username: "Système",
        text: `${user.username} a quitté le chat.`,
        type: "system"
      });
      delete users[socket.id];
      io.emit("userList", Object.values(users));
    }
  });
});

// === Démarrage du serveur ===
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Chat Server LaUneTV lancé sur le port ${PORT}`);
});
