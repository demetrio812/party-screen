import importlib.util, pathlib, threading, unittest, json, http.client
spec=importlib.util.spec_from_file_location('party_server',pathlib.Path(__file__).resolve().parents[1]/'server.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class RemoteTest(unittest.TestCase):
 def setUp(self):
  self.server=module.PartyServer(('127.0.0.1',0));self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
 def tearDown(self): self.server.shutdown();self.server.server_close()
 def call(self,path,data=None,headers=None):
  c=http.client.HTTPConnection('127.0.0.1',self.server.server_port);c.request('POST' if data is not None else 'GET',path,json.dumps(data) if data is not None else None,headers or {});r=c.getresponse();body=r.read();c.close();return r.status,json.loads(body) if body.startswith(b'{') else body
 def test_pairing_and_command_delivery(self):
  self.assertEqual(self.call('/api/state')[0],401)
  self.assertEqual(self.call('/api/join',{'pin':'wrong'})[0],401)
  status,data=self.call('/api/join',{'pin':self.server.pin});self.assertEqual(status,200)
  auth={'Authorization':'Bearer '+data['token']}
  command={'id':'one','command':'effect','value':'confetti'}
  self.assertEqual(self.call('/api/command',command,auth)[0],503)
  self.call('/api/host',{'hostId':'host','state':{'acks':[]}},auth)
  self.assertEqual(self.call('/api/command',command,auth)[0],202)
  self.call('/api/command',command,auth)
  status,data=self.call('/api/host',{'hostId':'host','state':{}},auth)
  self.assertEqual(len(data['commands']),1)
  self.assertEqual(data['commands'][0]['value'],'confetti')
  self.assertEqual(self.call('/api/host',{'hostId':'host','state':{}},auth)[1]['commands'],[])
 def test_files_and_host_api_are_restricted(self):
  for path in ['/.env.local','/../.env.local','/server.py','/tests/server_test.py']:
   self.assertEqual(self.call(path)[0],404)
  self.assertEqual(self.call('/api/pair',headers={'Host':'192.168.1.1'})[0],403)
  auth={'Authorization':'Bearer '+self.server.token,'Origin':'https://example.com'}
  self.assertEqual(self.call('/api/host',{'hostId':'x','state':{}},auth)[0],403)
 def test_offline_commands_expire_and_extra_admin_is_rejected(self):
  auth={'Authorization':'Bearer '+self.server.token}
  self.call('/api/host',{'hostId':'a','state':{}},auth)
  self.assertEqual(self.call('/api/host',{'hostId':'b','state':{}},auth)[0],409)
  self.call('/api/command',{'id':'old','command':'moment','value':'birthday'},auth)
  self.server.commands[0]['queuedAt']-=10
  self.assertEqual(self.call('/api/host',{'hostId':'a','state':{}},auth)[1]['commands'],[])
if __name__=='__main__':unittest.main()
