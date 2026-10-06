// Peer-hosted multiplayer over LAN WebSockets or WebRTC data channels.
const MAX_CPU = 12;
const N_TRACKS = 25;
const N_CHARS = 25;
const N_VEHICLES = 33;
const COUNT_SECONDS = 5;
const RESULT_SECONDS = 9;
const MAX_RACE_SECONDS = 300;
const AFTER_FIRST_SECONDS = 35;
const POINTS = [15, 12, 10, 8, 6, 4, 2, 1];
const BOT_NAMES = ["Alex", "Sam", "Jamie", "Taylor", "Morgan", "Casey", "Riley", "Jordan", "Avery", "Cameron", "Drew", "Robin", "Sky", "Quinn", "Reese", "Blake"];
const makeId = () => "p" + crypto.getRandomValues(new Uint32Array(2)).join("");
const clone = (value) => JSON.parse(JSON.stringify(value));

async function encodeCode(value, compact) {
  const text = JSON.stringify(value);
  if (!compact) return text;
  const zipped = new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer());
  let binary = "";
  for (let i = 0; i < zipped.length; i += 0x8000) binary += String.fromCharCode(...zipped.subarray(i, i + 0x8000));
  return "z:" + btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function decodeCode(text) {
  let raw = String(text || "").trim();
  if (raw.startsWith("z:")) {
    const encoded = raw.slice(2).replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(encoded + "=".repeat((4 - encoded.length % 4) % 4));
    const zipped = Uint8Array.from(binary, char => char.charCodeAt(0));
    raw = await new Response(new Blob([zipped]).stream().pipeThrough(new DecompressionStream("deflate"))).text();
  }
  const value = JSON.parse(raw);
  if (!value || typeof value.id !== "string" || !value.desc || typeof value.desc.sdp !== "string") throw new Error("Invalid connection code");
  return value;
}

function waitForIce(pc) {
  if (pc.iceGatheringState === "complete") return Promise.resolve(true);
  return new Promise(resolve => {
    const finish = (complete) => { pc.removeEventListener("icegatheringstatechange", changed); clearTimeout(timer); resolve(complete); };
    const changed = () => { if (pc.iceGatheringState === "complete") finish(true); };
    const timer = setTimeout(() => finish(false), 8000);
    pc.addEventListener("icegatheringstatechange", changed);
    changed();
  });
}

export class Net {
  constructor() {
    this.h = {}; this.id = null; this.role = null; this.lobby = null; this.race = null; this.ok = false;
    this.peers = new Map(); this.pending = new Map(); this.sendT = 0; this.prof = null;
    this.name = "LAN Room"; this.raceT = 0; this.firstFin = -1; this.nextNid = 1; this.cups = [];
    this.lanServer = false; this.lan = false; this.ws = null; this.roomRelay = false; this.roomCode = null;
    this.compactCodes = true; this.shortCodes = false; this.signalSocket = null; this.signalPending = new Map();
    this.lastIceComplete = true;
    this.online = false; this.onlineRoom = null; this.onlinePending = new Map(); this.matchId = null; this.serverCode = "";
    this.onlineSyncT = 0;
  }
  on(type, fn) { (this.h[type] || (this.h[type] = [])).push(fn); return this; }
  emit(type, m) { for (const f of this.h[type] || []) try { f(m); } catch (e) { console.error(e); } }
  makePlayer(id, profile) {
    const p = profile || { name: "Player", char: 0, veh: 0 };
    return { id, name: this.cleanName(p.name), char: this.clamp(p.char, N_CHARS), veh: this.clamp(p.veh, N_VEHICLES), spec: false };
  }
  cleanName(value) { return String(value || "").trim().replace(/\s+/g, " ").slice(0, 24) || "Player"; }
  clamp(value, length) { const n = Math.floor(+value); return Number.isFinite(n) && n >= 0 && n < length ? n : 0; }
  setCups(cups) { this.cups = Array.isArray(cups) ? cups.map(cup => cup.map(track => this.clamp(track, N_TRACKS))).filter(cup => cup.length) : []; }
  setSettings(value) {
    if (!this.isHost || !this.lobby || this.lobby.phase !== "wait") return;
    const modes = ["track", "grandPrix", "randomTrack", "randomPrix"];
    this.lobby.settings = {
      mode: modes.includes(value.mode) ? value.mode : "randomTrack",
      track: this.clamp(value.track, N_TRACKS), cup: this.clamp(value.cup, this.cups.length),
      cpuEnabled: !!value.cpuEnabled,
      cpuCount: Math.max(1, Math.min(MAX_CPU, Math.floor(+value.cpuCount) || MAX_CPU)),
    };
    this.lobby.series = null;
    this.broadcast({ type: "settings", settings: clone(this.lobby.settings) });
  }
  makeCpuRoster(count, used) {
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    return Array.from({ length: count }, (_, i) => {
      let char = Math.floor(Math.random() * N_CHARS);
      while (used.has(char)) char = (char + 1) % N_CHARS;
      used.add(char);
      return { seriesKey: "cpu-" + i, name: (names.pop() || "Driver") + " (CPU)", char, veh: Math.floor(Math.random() * N_VEHICLES), bot: true };
    });
  }
  async host() {
    if (!this.lanServer && !this.shortCodes && !window.RTCPeerConnection) { this.emit("error", { text: "WebRTC is not available. Choose the 8-character relay code instead." }); return false; }
    this.closeConnections();
    this.role = "host"; this.id = makeId(); this.ok = true; this.race = null; this.nextNid = 1;
    if (this.lanServer) {
      try { this.id = (await this.connectLan("host")).id; }
      catch (e) { this.emit("error", { text: e.message }); this.leave(); return false; }
    }
    const player = this.makePlayer(this.id, this.prof);
    this.lobby = { id: 0, name: "LAN Room", phase: "wait", t: 0, players: [player], track: -1, grid: [], host: this.id, raceT: 0, settings: { mode: "randomTrack", track: 0, cup: 0, cpuEnabled: true, cpuCount: MAX_CPU }, series: null };
    this.emit("joined", { you: this.id, lobby: clone(this.lobby) });
    if (!this.lanServer) {
      try { await this.createInvite(); } catch (e) { this.emit("error", { text: "Could not create an invite: " + e.message }); return false; }
    }
    return true;
  }
  async connectOnline() {
    if (typeof globalThis.WebsimSocket?.joinRoom !== "function") throw new Error("WebSim online doesn't work! LAN is in development.");
    if (this.onlineRoom) { this.onlineRoom.onmessage = null; this.onlineRoom.onclose = null; try { this.onlineRoom.close(); } catch {} }
    this.closeConnections();
    const room = await globalThis.WebsimSocket.joinRoom();
    this.onlineRoom = room; this.online = true;
    room.onmessage = (event) => {
      let message; try { message = JSON.parse(event.data); } catch { return; }
      if (message.replyTo && this.onlinePending.has(message.replyTo)) {
        const pending = this.onlinePending.get(message.replyTo); this.onlinePending.delete(message.replyTo); clearTimeout(pending.timer);
        message.error ? pending.reject(new Error(message.error)) : pending.resolve(message); return;
      }
      if (message.event === "relay") {
        if (this.role === "host") {
          this.peers.set(message.from, { id: message.from, online: true });
          this.hostMessage(message.from, message.message);
        } else this.handle(message.message);
      } else if (message.event === "peer-left" && this.role === "host") this.dropPeer(message.id);
      else if (message.event === "closed") this.emit("error", { text: message.text || "The server host left." });
      else if (message.event === "list") this.emit("onlineList", { matches: message.matches || [] });
    };
    room.onclose = (event) => {
      if (this.onlineRoom !== room) return;
      this.onlineRoom = null; this.online = false;
      const error = new Error(event.reason || "Websim Online disconnected.");
      for (const pending of this.onlinePending.values()) { clearTimeout(pending.timer); pending.reject(error); }
      this.onlinePending.clear(); this.emit("error", { text: error.message });
    };
  }
  onlineRequest(action, data = {}) {
    const requestId = makeId();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.onlinePending.delete(requestId); reject(new Error("Websim Online took too long to respond.")); }, 12000);
      this.onlinePending.set(requestId, { resolve, reject, timer });
      try { this.onlineRoom.send({ type: "wk-online", action, requestId, matchId: this.matchId, ...data }); }
      catch (error) { clearTimeout(timer); this.onlinePending.delete(requestId); reject(error); }
    });
  }
  async listOnline() {
    if (!this.onlineRoom) await this.connectOnline();
    return (await this.onlineRequest("list")).matches || [];
  }
  async hostOnline(publicServer) {
    await this.connectOnline();
    this.role = "host"; this.ok = true; this.nextNid = 1; this.race = null;
    const player = this.makePlayer("pending", this.prof);
    const settings = { mode: "randomTrack", track: 0, cup: 0, cpuEnabled: true, cpuCount: MAX_CPU };
    const result = await this.onlineRequest("create", { public: !!publicServer, profile: player, settings });
    this.matchId = result.matchId; this.id = result.you; this.serverCode = result.code || "";
    this.lobby = result.lobby;
    this.emit("joined", { you: this.id, lobby: clone(this.lobby) });
    return true;
  }
  async joinOnline(matchIdOrCode, byCode = false) {
    await this.connectOnline();
    this.role = "client"; this.ok = true;
    const result = await this.onlineRequest("join", { target: String(matchIdOrCode || ""), byCode: !!byCode, profile: this.prof });
    this.matchId = result.matchId; this.id = result.you; this.serverCode = result.code || ""; this.lobby = result.lobby;
    this.handle({ type: "joined", you: this.id, lobby: this.lobby });
    return true;
  }
  async quickPlay() {
    await this.connectOnline();
    this.role = "client"; this.ok = true;
    const result = await this.onlineRequest("quick", { profile: this.prof });
    this.matchId = result.matchId; this.id = result.you; this.serverCode = result.code || ""; this.lobby = result.lobby;
    this.handle({ type: "joined", you: this.id, lobby: this.lobby });
    return true;
  }
  async connectSignal() {
    if (this.signalSocket) return this.signalSocket;
    if (typeof globalThis.WebsimSocket?.joinRoom !== "function") throw new Error("Short room codes are unavailable here. Choose a manual code format.");
    const signal = await globalThis.WebsimSocket.joinRoom();
    this.signalSocket = signal;
    signal.onmessage = (event) => {
      let message; try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === "room-client-ready" && this.role === "host") {
        this.peers.set(message.peerId, { id: message.peerId, code: message.code, room: true, dc: null });
        signal.send({ type: "room-ready", code: message.code, to: message.peerId });
        this.emit("peeropen", { id: message.peerId }); return;
      }
      if (message.type === "room-ready" && this.role === "client" && message.code === this.roomCode) {
        this.send({ type: "join", profile: this.prof }); return;
      }
      if (message.type === "room-peer-left" && this.role === "host") { this.dropPeer(message.peerId); return; }
      if (message.type === "room-closed") { this.emit("error", { text: "The room host disconnected." }); return; }
      if (message.type === "room-error") { this.emit("error", { text: message.text || "The room connection failed." }); return; }
      if (message.type === "room-message") {
        if (this.role === "host") this.hostMessage(message.from, message.message);
        else this.handle(message.message);
        return;
      }
      const pending = this.signalPending.get(message.requestId);
      if (!pending) return;
      this.signalPending.delete(message.requestId); clearTimeout(pending.timer);
      if (message.type === "signal-error") pending.reject(new Error(message.text || "Signaling failed."));
      else pending.resolve(message);
    };
    signal.onclose = (event) => {
      if (this.signalSocket !== signal) return;
      this.signalSocket = null;
      for (const pending of this.signalPending.values()) { clearTimeout(pending.timer); pending.reject(new Error(event.reason || "Signaling connection closed.")); }
      this.signalPending.clear();
      this.emit("error", { text: event.reason || "Short-code signaling connection closed." });
    };
    return signal;
  }
  async signalRequest(message) {
    const signal = await this.connectSignal(), requestId = makeId();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.signalPending.delete(requestId); reject(new Error("Short-code service timed out.")); }, 12000);
      this.signalPending.set(requestId, { resolve, reject, timer });
      try { signal.send({ ...message, requestId }); }
      catch (error) { clearTimeout(timer); this.signalPending.delete(requestId); reject(error); }
    });
  }
  async createInvite() {
    if (this.role !== "host") throw new Error("Host a room first");
    if (this.shortCodes) {
      const session = await this.signalRequest({ type: "room-create" });
      this.roomRelay = true;
      this.emit("invite", { code: session.code, short: true });
      return session.code;
    }
    const id = makeId();
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    const peer = { id, pc, dc: null };
    this.pending.set(id, peer); this.peers.set(id, peer);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") { this.emit("error", { text: "Direct connection failed. Check both devices are on the same LAN and allow local network access." }); this.dropPeer(id); }
      else if (pc.connectionState === "closed") this.dropPeer(id);
    };
    const dc = pc.createDataChannel("race", { ordered: true });
    peer.dc = dc; this.bindChannel(peer);
    await pc.setLocalDescription(await pc.createOffer());
    const iceComplete = await waitForIce(pc);
    this.lastIceComplete = iceComplete;
    const desc = pc.localDescription.toJSON();
    const code = await encodeCode({ id, desc }, this.compactCodes);
    this.emit("invite", { code, short: false, iceComplete });
    return code;
  }
  async connectLan(role) {
    this.lan = true;
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = this.ws = new WebSocket(protocol + "//" + location.host + "/socket");
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => fail(new Error("LAN server did not respond.")), 8000);
      const fail = (error) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        if (this.ws === ws) this.ws = null;
        this.lan = false;
        try { ws.close(); } catch {}
        reject(error);
      };
      ws.onmessage = (event) => {
        let message; try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === "ready") { ws.send(JSON.stringify({ type: "register", role })); return; }
        if (message.type === "registered") {
          settled = true; clearTimeout(timer); this.id = message.id; resolve({ id: message.id }); return;
        }
        if (message.type === "error") {
          if (!settled) fail(new Error(message.text || "Could not connect to the LAN room."));
          else this.emit("error", { text: message.text || "LAN connection closed." });
          return;
        }
        if (message.type === "peer" && this.role === "host") {
          this.peers.set(message.id, { id: message.id, dc: null, lan: true }); this.emit("peeropen", { id: message.id }); return;
        }
        if (message.type === "peer-left" && this.role === "host") { this.dropPeer(message.id); return; }
        if (message.type === "message") {
          if (this.role === "host") this.hostMessage(message.from, message.message);
          else this.handle(message.message);
        }
      };
      ws.onerror = () => { if (!settled) fail(new Error("Could not reach the LAN server at this address.")); };
      ws.onclose = () => {
        if (!settled) fail(new Error("LAN server connection closed."));
        else if (this.ws === ws) { this.ws = null; this.ok = false; this.emit("error", { text: "Connection to the LAN server was lost." }); }
      };
    });
  }
  async joinLan() {
    if (!this.lanServer) throw new Error("Open this game from the LAN server address first.");
    this.closeConnections(); this.role = "client"; this.id = null; this.ok = false;
    try {
      await this.connectLan("client"); this.ok = true;
      this.send({ type: "join", profile: this.prof });
      return true;
    } catch (error) { this.leave(); throw error; }
  }
  async joinWithOffer(text) {
    const pasted = String(text || "").trim(), shortCode = pasted.replace(/\s/g, "").toUpperCase();
    const isShortCode = /^[A-HJ-NP-Z2-9]{8}$/.test(shortCode);
    if (isShortCode) {
      const session = await this.signalRequest({ type: "room-join", code: shortCode });
      this.closeConnections(); this.role = "client"; this.id = session.peerId; this.ok = true;
      this.roomRelay = true; this.roomCode = session.code;
      this.signalSocket.send({ type: "room-client-ready", code: session.code });
      return null;
    }
    if (!window.RTCPeerConnection) throw new Error("WebRTC is not available. Use an 8-character relay code.");
    const offer = await decodeCode(pasted);
    this.closeConnections();
    this.role = "client"; this.id = makeId(); this.ok = false;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    const peer = { id: offer.id, pc, dc: null };
    this.peers.set("host", peer);
    pc.ondatachannel = (event) => { peer.dc = event.channel; this.bindChannel(peer); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === "failed" || pc.connectionState === "closed") this.emit("error", { text: "Connection to the host was lost." }); };
    await pc.setRemoteDescription(offer.desc);
    await pc.setLocalDescription(await pc.createAnswer());
    const iceComplete = await waitForIce(pc);
    this.lastIceComplete = iceComplete;
    const desc = pc.localDescription.toJSON();
    const code = await encodeCode({ id: offer.id, desc }, this.compactCodes);
    this.emit("answer", { code, iceComplete });
    return code;
  }
  async acceptAnswer(text) {
    const answer = await decodeCode(text), peer = this.pending.get(answer.id);
    if (!peer) throw new Error("No pending invite matches this answer.");
    await peer.pc.setRemoteDescription(answer.desc);
    this.pending.delete(answer.id);
  }
  bindChannel(peer) {
    const dc = peer.dc;
    if (!dc) return;
    dc.onopen = () => {
      if (this.role === "client") {
        this.ok = true;
        this.send({ type: "join", profile: this.prof });
      }
      this.emit("peeropen", { id: peer.id });
    };
    dc.onmessage = (event) => {
      let message; try { message = JSON.parse(event.data); } catch { return; }
      if (this.role === "host") this.hostMessage(peer.id, message);
      else this.handle(message);
    };
    dc.onclose = () => {
      if (this.role === "host") this.dropPeer(peer.id);
      else { this.ok = false; this.emit("error", { text: "Connection to the host was closed." }); }
    };
  }
  closeConnections() {
    for (const peer of this.peers.values()) { try { peer.dc && peer.dc.close(); peer.pc && peer.pc.close(); } catch {} }
    this.peers.clear(); this.pending.clear();
    const ws = this.ws; this.ws = null; this.lan = false; this.roomRelay = false; this.roomCode = null;
    if (ws) { ws.onclose = null; try { ws.close(); } catch {} }
    this.online = false; this.onlineRoom = null; this.matchId = null; this.serverCode = "";
  }
  dropPeer(id) {
    const peer = this.peers.get(id); if (!peer) return;
    if (peer.signalCode && this.signalSocket) this.signalSocket.send({ type: "cancel", code: peer.signalCode });
    this.peers.delete(id); this.pending.delete(id);
    try { peer.dc && peer.dc.close(); peer.pc.close(); } catch {}
    if (this.role === "host" && this.lobby) this.hostMessage(id, { type: "leave" });
  }
  sendTo(peer, message) {
    if (this.online && this.onlineRoom) {
      this.onlineRoom.send({ type: "wk-online", action: "send", matchId: this.matchId, to: this.isHost ? peer?.id : this.lobby?.host, message }); return;
    }
    if (this.roomRelay && this.signalSocket) {
      const packet = { type: "room-send", code: this.isHost ? peer && peer.code : this.roomCode, message };
      if (this.isHost) packet.to = peer && peer.id;
      this.signalSocket.send(packet); return;
    }
    if (this.lan && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const packet = { type: "send", message };
      if (this.isHost) packet.to = peer && peer.id;
      this.ws.send(JSON.stringify(packet)); return;
    }
    if (peer && peer.dc && peer.dc.readyState === "open") peer.dc.send(JSON.stringify(message));
  }
  broadcast(message, except) {
    for (const [id, peer] of this.peers) if (id !== except) this.sendTo(peer, message);
    this.handle(message);
    if (this.online && this.isHost && this.onlineRoom && this.lobby && ["settings", "pjoin", "pupd", "left", "lobby", "race", "go", "results"].includes(message.type))
      this.onlineRoom.send({ type: "wk-online", action: "sync", matchId: this.matchId, lobby: this.lobbyInfo() });
  }
  send(message) {
    if (this.role === "host") this.hostMessage(this.id, message);
    else if (this.lan || this.roomRelay || this.online) this.sendTo(null, message);
    else { const peer = this.peers.get("host"); this.sendTo(peer, message); }
  }
  lobbyInfo() { return clone(this.lobby); }
  hostMessage(from, message) {
    const L = this.lobby;
    if (!L) return;
    const player = L.players.find(p => p.id === from);
    if (message.type === "voiceSignal") {
      this.emit("voiceSignal", { from, signal: message.signal });
      return;
    }
    switch (message.type) {
      case "join": {
        if (player) break;
        const p = this.makePlayer(from, message.profile);
        p.spec = ["count", "race"].includes(L.phase);
        L.players.push(p);
        if (!this.online) this.sendTo(this.peers.get(from), { type: "joined", you: from, lobby: this.lobbyInfo() });
        this.broadcast({ type: "pjoin", p, host: L.host }, from);
        break;
      }
      case "profile": {
        if (!player) break;
        player.name = this.cleanName(message.name);
        player.char = this.clamp(message.char, N_CHARS); player.veh = this.clamp(message.veh, N_VEHICLES);
        if (L.phase === "wait" || L.phase === "results") { player.spec = false; delete player.nextRace; }
        else if (L.phase === "count" || L.phase === "race") player.nextRace = true;
        this.broadcast({ type: "pupd", p: player }, from); break;
      }
      case "leave": this.removePlayer(from); break;
      case "st": {
        if (!player || !["race", "count"].includes(L.phase) || !Array.isArray(message.k)) break;
        const accepted = [];
        for (const state of message.k) {
          if (!Array.isArray(state) || state.length !== 16) continue;
          const grid = L.grid.find(k => k.nid === state[0]);
          if (!grid || (grid.owner !== from && !(grid.bot && from === L.host))) continue;
          const clean = state.map(v => Math.round(+v) || 0);
          this.race.states.set(clean[0], clean); accepted.push(clean);
        }
        if (accepted.length) this.broadcast({ type: "snap", k: accepted }, from);
        break;
      }
      case "ev":
        if (player && L.phase === "race" && message.e && typeof message.e === "object" && JSON.stringify(message.e).length < 600) this.broadcast({ type: "ev", from, e: message.e }, from);
        break;
      case "fin": {
        if (!player || L.phase !== "race") break;
        const nid = +message.nid, grid = L.grid.find(k => k.nid === nid);
        if (!grid || this.race.fin.has(nid) || (grid.owner !== from && !(grid.bot && from === L.host))) break;
        const time = Math.max(10, Math.min(MAX_RACE_SECONDS, +message.time || this.raceT));
        this.race.fin.set(nid, { time });
        if (this.firstFin < 0 && !grid.bot) this.firstFin = this.raceT;
        this.broadcast({ type: "fin", nid, time }, from); break;
      }
      case "ghostShare": {
        const ghost = message.ghost;
        const size = ghost && typeof ghost === "object" ? JSON.stringify(ghost).length : Infinity;
        if (!player || typeof ghost?.trackId !== "string" || typeof ghost.data !== "string" || ghost.data.length > 56000 || size > 60000) {
          this.sendTo(this.peers.get(from), { type: "ghostError", text: "Ghost data is invalid or too large." }); break;
        }
        this.broadcast({ type: "ghost", from, name: player.name, ghost }, from);
        this.sendTo(this.peers.get(from), { type: "ghostSent", trackId: ghost.trackId });
        break;
      }
      case "chat": {
        if (!player) break;
        const text = String(message.text || "").slice(0, 120).trim();
        if (text) this.broadcast({ type: "chat", from, name: player.name, text }, from);
        break;
      }
      case "emote": if (player) this.broadcast({ type: "emote", from, e: this.clamp(message.e, 8) }, from); break;
    }
  }
  removePlayer(id) {
    if (!this.lobby) return;
    const index = this.lobby.players.findIndex(p => p.id === id);
    if (index < 0) return;
    this.lobby.players.splice(index, 1);
    this.broadcast({ type: "left", id, host: this.lobby.host });
  }
  handle(message) {
    switch (message.type) {
      case "joined": this.id = message.you; this.lobby = message.lobby; this.race = null; break;
      case "pjoin": if (this.lobby) { this.lobby.players = this.lobby.players.filter(p => p.id !== message.p.id).concat([message.p]); this.lobby.host = message.host; } break;
      case "pupd": if (this.lobby) this.lobby.players = this.lobby.players.map(p => p.id === message.p.id ? message.p : p); break;
      case "left": if (this.lobby) { this.lobby.players = this.lobby.players.filter(p => p.id !== message.id); this.lobby.host = message.host; } break;
      case "settings": if (this.lobby) { this.lobby.settings = message.settings; this.lobby.series = null; } break;
      case "voiceSignal": break;
      case "ghost": case "ghostSent": case "ghostError": break;
      case "lobby": this.lobby = message.lobby; this.race = null; break;
      case "race":
        this.race = { track: message.track, grid: message.grid, host: message.host, seed: message.seed, startAt: performance.now() + message.t * 1000, states: new Map(), fin: new Map() };
        if (this.lobby) { this.lobby.phase = "count"; this.lobby.track = message.track; this.lobby.grid = message.grid; }
        break;
      case "go": if (this.lobby) this.lobby.phase = "race"; break;
      case "results": if (this.lobby) { this.lobby.phase = "results"; this.lobby.t = message.t; } break;
    }
    this.emit(message.type, message);
  }
  profile(char, veh, name) {
    this.prof = { name: this.cleanName(name ?? this.prof?.name), char, veh };
    if (this.role === "host" && this.lobby) this.hostMessage(this.id, { type: "profile", name: this.prof.name, char, veh });
    else this.send({ type: "profile", name: this.prof.name, char, veh });
  }
  leave() {
    if (this.online && this.onlineRoom) {
      try { this.onlineRoom.send({ type: "wk-online", action: "leave", matchId: this.matchId }); } catch {}
    } else if (this.role === "client") this.send({ type: "leave" });
    else if (this.role === "host") { for (const peer of this.peers.values()) this.sendTo(peer, { type: "left", id: this.id, host: this.id }); }
    const onlineRoom = this.onlineRoom;
    if (onlineRoom) { onlineRoom.onmessage = null; onlineRoom.onclose = null; try { onlineRoom.close(); } catch {} }
    this.closeConnections();
    const signal = this.signalSocket; this.signalSocket = null;
    if (signal) { signal.onmessage = null; signal.onclose = null; try { signal.close(); } catch {} }
    for (const pending of this.signalPending.values()) { clearTimeout(pending.timer); pending.reject(new Error("Left the room.")); }
    this.signalPending.clear();
    this.id = null; this.role = null; this.lobby = null; this.race = null; this.ok = false;
  }
  shareGhost(ghost) { this.send({ type: "ghostShare", ghost }); }
  chat(text) { this.send({ type: "chat", text }); }
  emote(e) { this.send({ type: "emote", e }); }
  voiceSignal(peerId, signal) {
    if (this.isHost) this.sendTo(this.peers.get(peerId), { type: "voiceSignal", signal });
    else this.send({ type: "voiceSignal", signal });
  }
  get isHost() { return this.role === "host"; }
  controls(grid) { return grid.owner === this.id || (grid.bot && this.isHost); }
  tick(dt, karts) {
    if (!this.race) return;
    this.sendT -= dt; if (this.sendT > 0) return; this.sendT = 1 / 15;
    const states = karts.filter(k => !k.remote && k.netId).map(k => k.netState());
    if (states.length) this.send({ type: "st", k: states });
  }
  hostTick(dt) {
    if (this.role !== "host" || !this.lobby) return;
    const L = this.lobby;
    if (L.phase === "wait") return;
    if (L.phase === "count") {
      L.t -= dt;
      if (L.t <= 0) { this.broadcast({ type: "go" }); L.phase = "race"; L.t = MAX_RACE_SECONDS; }
      return;
    }
    if (L.phase === "race") {
      this.raceT += dt; L.raceT = this.raceT; L.t -= dt;
      if (this.online && this.onlineRoom && this.isHost) {
        this.onlineSyncT -= dt;
        if (this.onlineSyncT <= 0) { this.onlineSyncT = 1; this.onlineRoom.send({ type: "wk-online", action: "sync", matchId: this.matchId, lobby: this.lobbyInfo() }); }
      }
      const humans = L.grid.filter(k => !k.bot && L.players.some(p => p.id === k.owner));
      const done = humans.every(k => this.race.fin.has(k.nid));
      if (done || L.t <= 0 || (this.firstFin >= 0 && this.raceT - this.firstFin > AFTER_FIRST_SECONDS) || !humans.length) this.finishRace();
      return;
    }
    if (L.phase === "results") {
      L.t -= dt;
      if (L.t <= 0) {
        if (L.series) {
          if (L.series.index + 1 < L.series.tracks.length) L.series.index++;
          else L.series = null;
        }
        L.phase = "wait"; L.t = 0; L.grid = []; L.track = -1; this.race = null; this.raceT = 0; this.firstFin = -1;
        for (const player of L.players) if (player.nextRace) { player.spec = false; delete player.nextRace; }
        this.broadcast({ type: "lobby", lobby: this.lobbyInfo() });
      }
    }
  }
  startNow() { if (this.isHost && this.lobby?.phase === "wait") this.startRace(); }
  startRace() {
    const L = this.lobby, settings = L.settings || { mode: "randomTrack", track: 0, cup: 0, cpuEnabled: true, cpuCount: MAX_CPU };
    const cpuCount = settings.cpuEnabled ? Math.max(1, Math.min(MAX_CPU, +settings.cpuCount || MAX_CPU)) : 0;
    const gpMode = settings.mode === "grandPrix" || settings.mode === "randomPrix";
    if (gpMode) {
      const cup = settings.mode === "randomPrix" && L.series?.mode === "randomPrix"
        ? L.series.cup
        : settings.mode === "randomPrix" ? Math.floor(Math.random() * Math.max(1, this.cups.length)) : this.clamp(settings.cup, this.cups.length);
      if (!L.series || L.series.mode !== settings.mode || L.series.cup !== cup || L.series.cpuCount !== cpuCount) {
        const used = new Set(L.players.map(p => p.char));
        const tracks = this.cups[cup] || [];
        L.series = { mode: settings.mode, cup, tracks: tracks.length ? tracks.slice() : [Math.floor(Math.random() * N_TRACKS)], index: 0, cpuCount, scores: {}, cpus: this.makeCpuRoster(cpuCount, used) };
      }
    } else L.series = null;
    const series = L.series;
    const track = series ? series.tracks[series.index] : settings.mode === "track" ? this.clamp(settings.track, N_TRACKS) : Math.floor(Math.random() * N_TRACKS);
    const used = new Set(L.players.map(p => p.char));
    const cpus = series ? series.cpus : this.makeCpuRoster(cpuCount, used);
    const grid = L.players.filter(p => !p.spec).map(p => ({ nid: this.nextNid++, owner: p.id, name: p.name, char: p.char, veh: p.veh, bot: false, seriesKey: "player:" + p.id }));
    for (const cpu of cpus) grid.push({ nid: this.nextNid++, owner: null, ...cpu });
    grid.sort(() => Math.random() - 0.5);
    L.phase = "count"; L.t = COUNT_SECONDS; L.track = track; L.grid = grid; L.raceT = 0;
    this.raceT = 0; this.firstFin = -1;
    this.broadcast({ type: "race", track, grid, host: this.id, t: COUNT_SECONDS, seed: Math.floor(Math.random() * 1e9), series: series ? { mode: series.mode, cup: series.cup, round: series.index + 1, rounds: series.tracks.length } : null });
  }
  sendItem(kart, item, back) { if (kart.netId) this.send({ type: "ev", e: { k: "item", nid: kart.netId, it: item, back: !!back } }); }
  sendAbility(kart) { if (kart.netId) this.send({ type: "ev", e: { k: "abil", nid: kart.netId } }); }
  finish(kart, time) { this.send({ type: "fin", nid: kart.netId, time }); }
  finishRace() {
    const L = this.lobby, race = this.race;
    if (!race || L.phase !== "race") return;
    const list = L.grid.map(k => { const finish = race.fin.get(k.nid), state = race.states.get(k.nid); return { nid: k.nid, name: k.name, char: k.char, bot: k.bot, owner: k.owner, seriesKey: k.seriesKey, time: finish ? finish.time : null, prog: state ? state[14] : 0 }; });
    list.sort((a, b) => (a.time !== null ? 0 : 1) - (b.time !== null ? 0 : 1) || (a.time !== null ? a.time - b.time : b.prog - a.prog));
    list.forEach((r, i) => r.pts = L.series ? Math.max(1, list.length - i) : POINTS[i] || 0);
    let seriesInfo = null;
    if (L.series) {
      for (const r of list) {
        const score = L.series.scores[r.seriesKey] || (L.series.scores[r.seriesKey] = { name: r.name, char: r.char, owner: r.owner, bot: r.bot, points: 0 });
        score.name = r.name; score.points += r.pts;
      }
      seriesInfo = {
        mode: L.series.mode, cup: L.series.cup, round: L.series.index + 1, rounds: L.series.tracks.length,
        complete: L.series.index + 1 >= L.series.tracks.length,
        standings: Object.values(L.series.scores).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)),
      };
    }
    L.phase = "results"; L.t = RESULT_SECONDS;
    this.broadcast({ type: "results", list, series: seriesInfo, t: RESULT_SECONDS });
  }
}
