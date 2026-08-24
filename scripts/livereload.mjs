import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';

var localIp = '127.0.0.1';
var nets = networkInterfaces();

var ignorePatterns = [
  /vmware/i,
  /virtual/i,
  /vbox/i,
  /wsl/i,
  /hyper-v/i,
  /docker/i,
  /vethernet/i
];

var names = Object.keys(nets);
for (var i = 0; i < names.length; i++) {
  var name = names[i];
  
  var shouldIgnore = false;
  for (var p = 0; p < ignorePatterns.length; p++) {
    if (ignorePatterns[p].test(name)) {
      shouldIgnore = true;
      break;
    }
  }
  if (shouldIgnore) {
    continue;
  }

  var netList = nets[name];
  for (var j = 0; j < netList.length; j++) {
    var net = netList[j];
    if (net.family === 'IPv4' && !net.internal) {
      localIp = net.address;
      break;
    }
  }
  
  if (localIp !== '127.0.0.1') {
    break;
  }
}

console.log("Configuring Capacitor Live Reload for IP: " + localIp);

var envCopy = Object.assign({}, process.env);
envCopy.CAP_LIVE_RELOAD = localIp;

var sync = spawn('npx', ['cap', 'sync', 'android'], {
  env: envCopy,
  stdio: 'inherit',
  shell: true
});

sync.on('close', function(code) {
  if (code !== 0) {
    console.error("Capacitor sync failed.");
    process.exit(code);
  }
  
  console.log("Capacitor synced!");
  console.log("The Android app will now load http://" + localIp + ":5173");
  console.log("Starting Vite dev server...");

  spawn('npm', ['run', 'dev', '--', '--host', '0.0.0.0'], {
    stdio: 'inherit',
    shell: true
  });
});
