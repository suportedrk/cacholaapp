import subprocess
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

try:
    import paramiko
except ImportError:
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'paramiko', '-q'])
    import paramiko

host = '187.77.255.31'
user = 'root'
password = 'C@ch0l@1553#0S'

commands = [
    'cd /opt/cacholaapp && git checkout main && git pull origin main && npm run build 2>&1 | tail -10',
    'pm2 restart all && pm2 list',
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, timeout=30)

for cmd in commands:
    print(f'\n=== COMMAND: {cmd[:80]} ===')
    stdin, stdout, stderr = client.exec_command(cmd, timeout=300)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    print(out)
    if err:
        print('STDERR:', err)

client.close()
print('\nDone.')
