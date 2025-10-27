// ===== LaUneTV Chat Server =====
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = createServer(app);

const allowedOrigins = [
  "https://launetv.fr",
  "https://www.launetv.fr",
  "http://localhost:3000"
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST"],
  credentials: true
};

app.use(cors(corsOptions));

const io = new Server(server, { cors: corsOptions });

app.get("/", (req, res) => {
  res.send("✅ LaUneTV Chat Server is running.");
});

let users = {}; // { socket.id: { username, role } }
let messages = []; // Historique (max 50 derniers)

// === Connexion client ===
io.on("connection", (socket) => {
  console.log("🔌 Nouveau client :", socket.id);

  // === JOIN ===
  socket.on("join", ({ username, role }) => {
    users[socket.id] = { username, role };
    console.log(`👤 ${username} (${role}) connecté.`);

    // 🔹 Envoi du rôle confirmé
    socket.emit("roleConfirmed", role);

    // 🔹 Envoi historique au nouveau client
    socket.emit("messageHistory", messages);

    // 🔹 Message système (optionnel — désactivé dans le client)
    const joinMsg = {
      username: "Système",
      text: `${username} a rejoint le chat.`,
      type: "system",
      time: Date.now()
    };
    io.emit("message", joinMsg);

    // ✅ Envoi à tous du nombre de connectés
    io.emit("userList", Object.values(users));
  });

  // === Message standard ===
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

  // === Suppression de message ===
  socket.on("deleteMessage", (msgId) => {
    const admin = users[socket.id];
    if (!admin) return;

    const roleStr = Array.isArray(admin.role)
      ? admin.role.join(",")
      : admin.role.toString();
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

  // === Kick ===
  socket.on("kickUser", (target) => {
    const kicker = users[socket.id];
    if (!kicker) return;

    const roleStr = Array.isArray(kicker.role)
      ? kicker.role.join(",")
      : kicker.role.toString();
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
      console.log(`🚨 ${target} exclu par ${kicker.username}`);

      const msg = {
        username: "Système",
        text: `${target} a été exclu du chat.`,
        type: "system",
        time: Date.now()
      };
      io.emit("message", msg);
      io.emit("userList", Object.values(users));
    }
  });

  // === Déconnexion ===
  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (user) {
      console.log(`❌ ${user.username} s’est déconnecté`);
      delete users[socket.id];

      const msg = {
        username: "Système",
        text: `${user.username} a quitté le chat.`,
        type: "system",
        time: Date.now()
      };
      io.emit("message", msg);

      // ✅ Met à jour le compteur de connectés
      io.emit("userList", Object.values(users));
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Chat Server LaUneTV lancé sur le port ${PORT}`);
});
