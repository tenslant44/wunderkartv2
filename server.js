const sessions = new Map();
const connections = new Map();
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_TTL = 6 * 60 * 60 * 1000;
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;
const MAX_MESSAGE = 60000;
const onlineMatches = new Map();
const onlineMembership = new Map();
const MAX_ONLINE_PLAYERS = 8;
const MAX_ONLINE_SPECTATORS = 16;

function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (value) => CODE_ALPHABET[value & 31]).join("");
}

function cleanExpired(now) {
  for (const [code, session] of sessions) if (session.expires <= now) sessions.delete(code);
}

function fail(conn, requestId, text) {
  conn.send({ type: "signal-error", requestId: typeof requestId === "string" ? requestId : "", text });
}

function onlineCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, value => alphabet[value & 31]).join("");
}
function onlineProfile(value, conn, room) {
  const name = room.censor(String(value?.name || conn.username || "Player")).replace(/\s+/g, " ").slice(0, 24) || "Player";
  return { id: conn.id, name, char: Math.max(0, Math.min(24, Math.floor(+value?.char || 0))), veh: Math.max(0, Math.min(32, Math.floor(+value?.veh || 0))), spec: false };
}
function onlineSummary(match) {
  const players = match.lobby.phase === "wait" ? match.members.size : match.lobby.players.filter(player => !player.spec).length;
  return { id: match.id, code: match.code, name: match.lobby.name, visibility: match.visibility, phase: match.lobby.phase, players, spectators: match.lobby.players.length - players, cpuEnabled: !!match.lobby.settings?.cpuEnabled, cpuCount: match.lobby.settings?.cpuEnabled ? match.lobby.settings.cpuCount : 0, created: match.created };
}
function onlineSend(id, data) { connections.get(id)?.send({ type: "wk-online", ...data }); }
function onlineRemove(connId, notify = true) {
  const matchId = onlineMembership.get(connId), match = onlineMatches.get(matchId);
  onlineMembership.delete(connId);
  if (!match) return;
  if (connId === match.host) {
    for (const member of match.members) if (member !== connId) onlineSend(member, { event: "closed", text: "The server host left." });
    for (const member of match.members) onlineMembership.delete(member);
    onlineMatches.delete(match.id); return;
  }
  match.members.delete(connId);
  if (notify) onlineSend(match.host, { event: "relay", from: connId, message: { type: "leave" } });
  match.lobby.players = match.lobby.players.filter(player => player.id !== connId);
}
function onlineJoin(match, conn, profile, requestId, room) {
  if (!match || onlineMembership.has(conn.id)) {
    conn.send({ type: "wk-online", replyTo: requestId, error: "You are already in a server or that server is unavailable." }); return;
  }
  const racers = match.lobby.phase === "wait" ? match.members.size : match.lobby.players.filter(player => !player.spec).length;
  const spec = ["count", "race"].includes(match.lobby.phase);
  if (spec && match.members.size >= MAX_ONLINE_PLAYERS + MAX_ONLINE_SPECTATORS || !spec && racers >= MAX_ONLINE_PLAYERS) {
    conn.send({ type: "wk-online", replyTo: requestId, error: "That server is full." }); return;
  }
  const player = onlineProfile(profile, conn, room); player.spec = spec;
  match.members.add(conn.id); onlineMembership.set(conn.id, match.id);
  onlineSend(match.host, { event: "relay", from: conn.id, message: { type: "join", profile: player } });
  const lobby = JSON.parse(JSON.stringify(match.lobby)); lobby.players.push(player);
  conn.send({ type: "wk-online", replyTo: requestId, event: "joined", matchId: match.id, you: conn.id, code: match.visibility === "private" ? match.code : "", lobby });
}
function onlineMessage(conn, message, room) {
  const requestId = typeof message.requestId === "string" ? message.requestId : "";
  if (message.action === "list") {
    const matches = [...onlineMatches.values()].filter(match => match.visibility === "public").map(onlineSummary).sort((a, b) => b.players - a.players || a.created - b.created);
    conn.send({ type: "wk-online", replyTo: requestId, event: "list", matches }); return;
  }
  if (message.action === "create") {
    if (onlineMembership.has(conn.id)) return conn.send({ type: "wk-online", replyTo: requestId, error: "Leave your current server first." });
    let code; do { code = onlineCode(); } while ([...onlineMatches.values()].some(match => match.code === code));
    const profile = onlineProfile(message.profile, conn, room);
    const settings = { mode: "randomTrack", track: 0, cup: 0, cpuEnabled: true, cpuCount: 12, ...(message.settings || {}) };
    settings.cpuCount = Math.max(1, Math.min(12, Math.floor(+settings.cpuCount || 12)));
    const visibility = message.public ? "public" : "private", id = conn.id + ":" + code;
    const lobby = { id, name: visibility === "public" ? "Public Server" : "Private Server", phase: "wait", t: 0, players: [profile], track: -1, grid: [], host: conn.id, raceT: 0, settings, series: null };
    const match = { id, code, visibility, host: conn.id, members: new Set([conn.id]), lobby, created: Date.now() };
    onlineMatches.set(id, match); onlineMembership.set(conn.id, id);
    conn.send({ type: "wk-online", replyTo: requestId, event: "created", matchId: id, you: conn.id, code, lobby }); return;
  }
  if (message.action === "quick") {
    const match = [...onlineMatches.values()].filter(item => item.visibility === "public" && item.lobby.phase === "wait" && item.lobby.settings?.cpuEnabled && item.members.size < MAX_ONLINE_PLAYERS).sort((a, b) => b.members.size - a.members.size || a.created - b.created)[0];
    if (!match) return conn.send({ type: "wk-online", replyTo: requestId, error: "No open public server with bots is available. Create one or try again." });
    onlineJoin(match, conn, message.profile, requestId, room); return;
  }
  if (message.action === "join") {
    const target = String(message.target || "").trim();
    const match = message.byCode ? [...onlineMatches.values()].find(item => item.visibility === "private" && item.code === target.toUpperCase()) : onlineMatches.get(target);
    if (!match || (!message.byCode && match.visibility !== "public")) return conn.send({ type: "wk-online", replyTo: requestId, error: "Server not found. Check the code or refresh the list." });
    onlineJoin(match, conn, message.profile, requestId, room); return;
  }
  const match = onlineMatches.get(onlineMembership.get(conn.id));
  if (!match || match.id !== message.matchId) return;
  if (message.action === "sync" && conn.id === match.host && message.lobby && JSON.stringify(message.lobby).length < 50000) {
    match.lobby = message.lobby; return;
  }
  if (message.action === "leave") { onlineRemove(conn.id); return; }
  if (message.action !== "send" || !message.message || typeof message.message !== "object" || JSON.stringify(message.message).length > MAX_MESSAGE) return;
  const target = conn.id === match.host ? String(message.to || "") : match.host;
  if (!match.members.has(target)) return;
  const outgoing = JSON.parse(JSON.stringify(message.message));
  const clean = value => {
    if (Array.isArray(value)) return value.map(clean);
    if (!value || typeof value !== "object") return value;
    for (const [key, item] of Object.entries(value)) {
      if (["name", "username", "sharedBy", "text"].includes(key) && typeof item === "string") value[key] = room.censor(item).slice(0, key === "text" ? 120 : 24);
      else value[key] = clean(item);
    }
    return value;
  };
  onlineSend(target, { event: "relay", from: conn.id, message: clean(outgoing) });
}

export const room = {
  async onConnect(conn) {
    connections.set(conn.id, conn);
  },
  async onMessage(conn, raw, room) {
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    if (!message || typeof message !== "object") return;
    if (message.type === "wk-online") { onlineMessage(conn, message, room); return; }
    const requestId = message.requestId;
    const now = Date.now();
    cleanExpired(now);

    if (message.type === "room-create") {
      let code;
      do { code = makeCode(); } while (sessions.has(code));
      sessions.set(code, { hostId: conn.id, clientId: null, expires: now + CODE_TTL });
      conn.send({ type: "room-code", requestId, code });
      return;
    }

    const code = String(message.code || "").replace(/\s/g, "").toUpperCase();
    const session = CODE_PATTERN.test(code) ? sessions.get(code) : null;
    if (!session) return fail(conn, requestId, "Room code expired or not found.");

    if (message.type === "room-join") {
      if (session.hostId === conn.id) return fail(conn, requestId, "Open the code on another device.");
      if (session.clientId && session.clientId !== conn.id) return fail(conn, requestId, "That code has already been used.");
      const host = connections.get(session.hostId);
      if (!host) { sessions.delete(code); return fail(conn, requestId, "The host has left the room."); }
      session.clientId = conn.id;
      session.expires = now + CODE_TTL;
      conn.send({ type: "room-joined", requestId, code, peerId: conn.id });
      return;
    }

    if (message.type === "room-client-ready") {
      if (session.clientId !== conn.id) return fail(conn, requestId, "You are not connected to this room.");
      const host = connections.get(session.hostId);
      if (!host) { sessions.delete(code); return fail(conn, requestId, "The host has left the room."); }
      host.send({ type: "room-client-ready", code, peerId: conn.id });
      return;
    }

    if (message.type === "room-ready") {
      if (conn.id !== session.hostId || message.to !== session.clientId) return fail(conn, requestId, "Invalid room player.");
      const client = connections.get(session.clientId);
      if (!client) return fail(conn, requestId, "The player disconnected.");
      client.send({ type: "room-ready", code });
      return;
    }

    if (message.type === "room-send") {
      if (!message.message || typeof message.message !== "object" || JSON.stringify(message.message).length > MAX_MESSAGE) return;
      const cleanText = (value) => room.censor(String(value || ""));
      const sanitize = (value) => {
        if (Array.isArray(value)) return value.map(sanitize);
        if (!value || typeof value !== "object") return value;
        for (const [key, item] of Object.entries(value)) {
          if (["name", "username", "sharedBy", "text"].includes(key) && typeof item === "string") value[key] = cleanText(item).slice(0, key === "text" ? 120 : 24);
          else value[key] = sanitize(item);
        }
        return value;
      };
      const outgoing = sanitize(JSON.parse(JSON.stringify(message.message)));
      let target;
      if (conn.id === session.hostId && session.clientId && message.to === session.clientId) target = connections.get(session.clientId);
      else if (conn.id === session.clientId) target = connections.get(session.hostId);
      else return;
      if (!target) { conn.send({ type: "room-error", code, text: "The other player disconnected." }); return; }
      session.expires = now + CODE_TTL;
      target.send({ type: "room-message", code, from: conn.id, message: outgoing });
    }
  },
  async onClose(conn) {
    connections.delete(conn.id);
    onlineRemove(conn.id);
    for (const [code, session] of sessions) {
      if (session.hostId === conn.id) {
        connections.get(session.clientId)?.send({ type: "room-closed", code });
        sessions.delete(code);
      } else if (session.clientId === conn.id) {
        connections.get(session.hostId)?.send({ type: "room-peer-left", code, peerId: conn.id });
        sessions.delete(code);
      }
    }
  },
};

export default {
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
};
