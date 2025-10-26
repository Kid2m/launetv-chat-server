// ===== LaUneTV Chat Server =====
// Node.js + Socket.io
// v1.0 - Compatible Render & WordPress Front

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // à sécuriser plus tard avec ton domaine
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.get("/", (req, res) => {
  res.send("✅ LaUneTV Chat Server is running.");
});

// === Gestion des utilisateurs ===
let users = {}; // { socket.id: { username, role } }

io.on("connection", (socket) => {
  console.log("🔌 Nouveau client connecté :", socket.id);

  // Nouveau user
  socket.on("join", ({ username, role }) => {
    users[socket.id] = { username, role };
    io.emit("userList", Object.values(users));
    io.emit("message", {
      username: "Système",
      text: `${username} a rejoint le chat.`,
      type: "system"
    });
  });

  // Message classique
  socket.on("message", (text) => {
    const user = users[socket.id];
    if (!user) return;
    io.emit("message", { username: user.username, text, type: "user" });
  });

  // Modération : suppression d’un user
  socket.on("kickUser", (target) => {
    const kicker = users[socket.id];
    if (kicker?.role !== "admin" && kicker?.role !== "moderator") return;
    const targetId = Object.keys(users).find(
      (id) => users[id].username === target
    );
    if (targetId) {
      io.to(targetId).emit("kicked");
      io.sockets.sockets.get(targetId)?.disconnect(true);
      delete users[targetId];
      io.emit("userList", Object.values(users));
      io.emit("message", {
        username: "Système",
        text: `${target} a été exclu du chat.`,
        type: "system"
      });
    }
  });

  // Déconnexion
  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (user) {
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
