module.exports = {
  apps: [{
    name: "cacholaos",
    script: "node_modules/next/dist/bin/next",
    args: "start",
    cwd: "/opt/cacholaapp",
    instances: 2,
    exec_mode: "cluster",
    env: {
      NODE_ENV: "production",
      PORT: 3001
    },
    max_memory_restart: "500M",
    error_file: "/var/log/cacholaos-error.log",
    out_file: "/var/log/cacholaos-out.log",
    merge_logs: true,
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    autorestart: true,
    watch: false,
    max_restarts: 10,
    restart_delay: 4000
  }]
};
