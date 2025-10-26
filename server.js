// =============================
// 🎥 LaUneTV Chat Server — v2.0
// Compatible Render & WordPress (Ultimate Member)
// =============================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = createServer(app);

app.use(cors({
  origin: "*", // à sécuriser plus tard : ["https://launetv.fr"]
  methods: ["GET", "POST"]
}));

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.get("/", (req, res) => {
  res.send("✅ Serveur de chat LaUneTV en ligne !");
});

// === Gestion des utilisateurs ===
let users = {}; // { socket.id: { username, role } }

// === Vérifie si un rôle est modérateur ou admin
const isModerator = (role) => {
  return role === "um_admin" || role === "um_modo";
};

// === Événements WebSocket ===
io.on("connection", (socket) => {
  console.log("🔌 Nouveau client connecté :", socket.id);

  // === Lorsqu’un utilisateur rejoint
  socket.on("join", ({ username, role }) => {
    // Rôle par défaut si non défini
    const cleanRole = role || "um_membre";

    users[socket.id] = { username, role: cleanRole };
    io.emit("userList", Object.values(users));

    io.emit("message", {
      username: "Système",
      text: `${username} a rejoint le chat.`,
      type: "system"
    });
  });

  // === Lorsqu’un message est envoyé
  socket.on("message", (text) => {
    const user = users[socket.id];
    if (!user) return;

    io.emit("message", {
      username: user.username,
      role: user.role,
      text,
      type: "user"
    });
  });

  // === Modération : exclusion d’un utilisateur
  socket.on("kickUser", (targetUsername) => {
    const kicker = users[socket.id];
    if (!kicker || !isModerator(kicker.role)) {
      console.warn(`⛔ Action refusée : ${kicker?.username || "Inconnu"} (${kicker?.role})`);
      return;
    }

    const targetId = Object.keys(users).find(
      (id) => users[id].username === targetUsername
    );

    if (targetId) {
      io.to(targetId).emit("kicked");
      io.sockets.sockets.get(targetId)?.disconnect(true);
      delete users[targetId];
      io.emit("userList", Object.values(users));

      io.emit("message", {
        username: "Système",
        text: `${targetUsername} a été exclu du chat par ${kicker.username}.`,
        type: "system"
      });

      console.log(`🗑️ ${targetUsername} kické par ${kicker.username}`);
    }
  });

  // === Déconnexion
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

// === Lancement du serveur ===
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Serveur LaUneTV lancé sur le port ${PORT}`);
});
