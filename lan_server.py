#!/usr/bin/env python3
"""Serve Wunderkart to a local network and relay one player-hosted room."""
import argparse
import base64
import hashlib
import json
import socket
import struct
import threading
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAX_MESSAGE = 512 * 1024


def read_exact(stream, size):
    chunks = bytearray()
    while len(chunks) < size:
        chunk = stream.read(size - len(chunks))
        if not chunk:
            raise ConnectionError("WebSocket closed")
        chunks.extend(chunk)
    return bytes(chunks)


class Client:
    def __init__(self, server, connection, stream):
        self.server = server
        self.connection = connection
        self.stream = stream
        self.id = uuid.uuid4().hex[:12]
        self.role = None
        self.write_lock = threading.Lock()

    def send_frame(self, opcode, payload=b""):
        length = len(payload)
        head = bytes([0x80 | opcode])
        if length < 126:
            head += bytes([length])
        elif length <= 65535:
            head += bytes([126]) + struct.pack("!H", length)
        else:
            head += bytes([127]) + struct.pack("!Q", length)
        with self.write_lock:
            self.connection.sendall(head + payload)

    def send(self, message):
        try:
            payload = json.dumps(message, separators=(",", ":")).encode("utf-8")
            self.send_frame(1, payload)
            return True
        except (OSError, ValueError):
            return False

    def read_frame(self):
        first, second = read_exact(self.stream, 2)
        opcode = first & 0x0F
        length = second & 0x7F
        if length == 126:
            length = struct.unpack("!H", read_exact(self.stream, 2))[0]
        elif length == 127:
            length = struct.unpack("!Q", read_exact(self.stream, 8))[0]
        masked = second & 0x80
        mask = read_exact(self.stream, 4) if masked else b""
        if length > MAX_MESSAGE:
            raise ValueError("Message too large")
        payload = read_exact(self.stream, length)
        if masked:
            payload = bytes(value ^ mask[i % 4] for i, value in enumerate(payload))
        return opcode, payload

    def run(self):
        self.send({"type": "ready", "id": self.id})
        try:
            while True:
                opcode, payload = self.read_frame()
                if opcode == 8:
                    break
                if opcode == 9:
                    self.send_frame(10, payload)
                    continue
                if opcode != 1:
                    continue
                if len(payload) > MAX_MESSAGE:
                    break
                try:
                    message = json.loads(payload)
                except (UnicodeDecodeError, json.JSONDecodeError):
                    continue
                if isinstance(message, dict):
                    self.server.dispatch(self, message)
        except (ConnectionError, OSError, ValueError):
            pass
        finally:
            self.server.remove(self)
            self.close()

    def close(self):
        try:
            self.connection.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass
        try:
            self.connection.close()
        except OSError:
            pass


class LanServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, address, handler):
        super().__init__(address, handler)
        self.lock = threading.RLock()
        self.clients = {}
        self.host = None

    def dispatch(self, client, message):
        kind = message.get("type")
        if kind == "register" and client.role is None:
            role = message.get("role")
            if role == "host":
                with self.lock:
                    if self.host is not None:
                        client.send({"type": "error", "text": "A player is already hosting on this LAN server."})
                        return
                    client.role = "host"
                    self.host = client
                    self.clients[client.id] = client
                client.send({"type": "registered", "role": "host", "id": client.id})
                return
            if role == "client":
                with self.lock:
                    host = self.host
                    if host is None:
                        client.send({"type": "error", "text": "No player is hosting a room yet."})
                        return
                    client.role = "client"
                    self.clients[client.id] = client
                host.send({"type": "peer", "id": client.id})
                client.send({"type": "registered", "role": "client", "id": client.id})
                return
            client.send({"type": "error", "text": "Choose host or client mode."})
            return

        if kind != "send" or client.role is None:
            return
        content = message.get("message")
        if not isinstance(content, dict) or len(json.dumps(content)) > MAX_MESSAGE:
            return
        if client.role == "host":
            target_id = message.get("to")
            with self.lock:
                target = self.clients.get(target_id) if isinstance(target_id, str) else None
            if target and target.role == "client":
                target.send({"type": "message", "message": content})
        elif client.role == "client":
            with self.lock:
                host = self.host
            if host:
                host.send({"type": "message", "from": client.id, "message": content})

    def remove(self, client):
        peers = []
        host = None
        with self.lock:
            if self.clients.pop(client.id, None) is None:
                return
            if self.host is client:
                self.host = None
                peers = [peer for peer in self.clients.values() if peer.role == "client"]
                for peer in peers:
                    self.clients.pop(peer.id, None)
            elif client.role == "client":
                host = self.host
        if host:
            host.send({"type": "peer-left", "id": client.id})
        for peer in peers:
            peer.send({"type": "error", "text": "The player-hosted room has closed."})
            peer.close()


class Handler(SimpleHTTPRequestHandler):
    server_version = "WunderkartLAN/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/lan-status":
            addresses = lan_addresses()
            urls = [f"http://{address}:{self.server.server_address[1]}" for address in addresses]
            if not urls:
                urls = [f"http://127.0.0.1:{self.server.server_address[1]}"]
            body = json.dumps({"lan": True, "urls": urls}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path.split("?", 1)[0] == "/socket":
            key = self.headers.get("Sec-WebSocket-Key")
            if self.headers.get("Upgrade", "").lower() != "websocket" or not key:
                self.send_error(400, "WebSocket upgrade required")
                return
            accept = base64.b64encode(hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()).decode()
            self.send_response(101, "Switching Protocols")
            self.send_header("Upgrade", "websocket")
            self.send_header("Connection", "Upgrade")
            self.send_header("Sec-WebSocket-Accept", accept)
            self.end_headers()
            Client(self.server, self.connection, self.rfile).run()
            self.close_connection = True
            return
        super().do_GET()

    def log_message(self, format, *args):
        pass


def lan_addresses():
    addresses = set()
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("192.0.2.1", 80))
        addresses.add(probe.getsockname()[0])
    except OSError:
        pass
    finally:
        probe.close()
    try:
        addresses.update(ip for ip in socket.gethostbyname_ex(socket.gethostname())[2] if not ip.startswith("127."))
    except OSError:
        pass
    return sorted(addresses)


def main():
    parser = argparse.ArgumentParser(description="Host Wunderkart on your local network")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    import os
    os.chdir(ROOT)
    server = LanServer(("0.0.0.0", args.port), Handler)
    urls = [f"http://{address}:{args.port}" for address in lan_addresses()]
    if not urls:
        urls = [f"http://127.0.0.1:{args.port}"]
    print("Wunderkart LAN server. Open this address on each device:", flush=True)
    for url in urls:
        print("  " + url, flush=True)
    print("Keep this process running; allow Python through the host firewall if prompted.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
