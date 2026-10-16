"""Local Wi-Fi party controller. Files are allowlisted; control requires pairing."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
import json, secrets, time, threading, socket, subprocess, webbrowser, sys

ROOT = Path(__file__).resolve().parent
FILES = {'index.html':'text/html', 'remote.html':'text/html', 'style.css':'text/css',
         'remote.js':'text/javascript', 'phone-bridge.js':'text/javascript',
         'app.js':'text/javascript', 'moments.js':'text/javascript', 'celebrations.js':'text/javascript'}
class PartyServer(ThreadingHTTPServer):
    daemon_threads = True
    def __init__(self, address):
        super().__init__(address, Handler)
        self.token = secrets.token_urlsafe(24)
        self.pin = str(secrets.randbelow(900000)+100000)
        self.lock = threading.Lock()
        self.snapshot = {}
        self.heartbeat = 0
        self.commands = []
        self.seen = set()
        self.failures = {}
        self.host_id = None
    def phone_urls(self):
        addresses = []
        for interface in ('en0','en1'):
            try:
                ip = subprocess.check_output(['/usr/sbin/ipconfig','getifaddr',interface],stderr=subprocess.DEVNULL,text=True,timeout=1).strip()
                if ip and ip not in addresses: addresses.append(ip)
            except (OSError,subprocess.SubprocessError): pass
        try:
            for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
                if not ip.startswith('127.') and ip not in addresses: addresses.append(ip)
        except OSError: pass
        return [f'http://{ip}:{self.server_port}/remote.html' for ip in addresses]
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_): pass
    def local(self): return self.client_address[0] in ('127.0.0.1','::1') and self.headers.get('Host','').split(':')[0] in ('127.0.0.1','localhost')
    def origin_ok(self):
        origin = self.headers.get('Origin')
        return not origin or origin == 'http://'+self.headers.get('Host','')
    def authorized(self): return secrets.compare_digest(self.headers.get('Authorization',''), 'Bearer '+self.server.token)
    def reply(self, code, data, mime='application/json'):
        body = json.dumps(data).encode() if mime=='application/json' else data
        self.send_response(code); self.send_header('Content-Type',mime); self.send_header('Content-Length',str(len(body)))
        self.send_header('Cache-Control','no-store'); self.send_header('X-Content-Type-Options','nosniff'); self.end_headers()
        try: self.wfile.write(body)
        except (BrokenPipeError,ConnectionResetError): pass
    def do_GET(self):
        path = urlsplit(self.path).path
        if path=='/api/pair':
            if not self.local() or not self.origin_ok(): return self.reply(403,{'error':'Open Party desk on this laptop.'})
            return self.reply(200,{'token':self.server.token,'pin':self.server.pin,'urls':self.server.phone_urls()})
        if path=='/api/state':
            if not self.authorized() or not self.origin_ok(): return self.reply(401,{'error':'Pair this phone again.'})
            with self.server.lock:
                return self.reply(200,{'online':time.monotonic()-self.server.heartbeat<4,'state':self.server.snapshot})
        if path.startswith('/api/'): return self.reply(404,{'error':'Not found'})
        name=path.lstrip('/') or ('index.html' if self.local() else 'remote.html')
        if name not in FILES: return self.reply(404,{'error':'Not found'})
        self.reply(200,(ROOT/name).read_bytes(),FILES[name])
    def do_POST(self):
        if not self.origin_ok(): return self.reply(403,{'error':'Use the pairing page.'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if size<1 or size>150000: return self.reply(413,{'error':'Request too large.'})
            data=json.loads(self.rfile.read(size))
            if not isinstance(data,dict): raise ValueError()
        except (ValueError,json.JSONDecodeError): return self.reply(400,{'error':'Invalid request.'})
        path=urlsplit(self.path).path; now=time.monotonic(); server=self.server
        if path=='/api/join':
            with server.lock:
                attempts=[t for t in server.failures.get(self.client_address[0],[]) if now-t<60]
                if len(attempts)>=8: return self.reply(429,{'error':'Wait a minute, then try the code on the laptop.'})
                if not secrets.compare_digest(str(data.get('pin','')),server.pin):
                    server.failures[self.client_address[0]]=attempts+[now]
                    return self.reply(401,{'error':'That code doesn’t match. Check the laptop.'})
                server.failures.pop(self.client_address[0],None)
                return self.reply(200,{'token':server.token})
        if not self.authorized(): return self.reply(401,{'error':'Pair this phone again.'})
        if path=='/api/host':
            if not self.local(): return self.reply(403,{'error':'The show runs on the laptop.'})
            host=data.get('hostId'); state=data.get('state')
            if not isinstance(host,str) or not isinstance(state,dict): return self.reply(400,{'error':'Invalid host state.'})
            with server.lock:
                if server.host_id not in (None,host) and now-server.heartbeat<4: return self.reply(409,{'error':'Another Party desk is already running. Close the extra admin window.'})
                server.host_id=host;server.snapshot=state;server.heartbeat=now
                commands=[c for c in server.commands if now-c['queuedAt']<5]
                server.commands=[]
                return self.reply(200,{'commands':commands})
        if path=='/api/command':
            command=data.get('command'); ident=data.get('id'); value=data.get('value','')
            if command not in ('moment','effect','clear','return') or not isinstance(ident,str) or not 1<=len(ident)<=100 or not isinstance(value,str) or len(value)>100:
                return self.reply(400,{'error':'Invalid control.'})
            with server.lock:
                if now-server.heartbeat>=4: return self.reply(503,{'error':'Open Party desk on the laptop first.'})
                if ident not in server.seen:
                    if len(server.commands)>=30: return self.reply(429,{'error':'Wait for the previous controls to finish.'})
                    if len(server.seen)>1000: server.seen.clear()
                    server.seen.add(ident);server.commands.append({'id':ident,'command':command,'value':value,'queuedAt':now})
                return self.reply(202,{'queued':True})
        self.reply(404,{'error':'Not found'})
def main():
    port=int(sys.argv[1]) if len(sys.argv)>1 and sys.argv[1].isdigit() else 8765
    try: server=PartyServer(('0.0.0.0',port))
    except OSError: server=PartyServer(('0.0.0.0',0))
    url=f'http://127.0.0.1:{server.server_port}/'
    print(f'Party desk: {url}',flush=True)
    print('Keep this window open. Phone pairing details are in Party desk.',flush=True)
    if '--no-open' not in sys.argv: threading.Timer(.4,lambda:webbrowser.open(url)).start()
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()
if __name__=='__main__': main()
