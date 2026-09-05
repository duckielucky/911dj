#!/bin/bash
# Serves this folder on a local port so the browser can remember your library,
# then opens it. Close this Terminal window (or press Ctrl-C) to stop.
cd "$(dirname "$0")" || exit 1

PY=""
for c in python3 python; do command -v "$c" >/dev/null 2>&1 && PY="$c" && break; done

if [ -z "$PY" ]; then
  echo "未找到 Python，将直接打开文件（曲库不会被保存）。"
  open index.html
  exit 0
fi

PORT=8123
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done

echo "911.COM 已启动：http://localhost:$PORT"
echo "听歌时请保持此窗口开启，按 Ctrl-C 停止。"
( sleep 1; open "http://localhost:$PORT" ) &
exec "$PY" -m http.server "$PORT" --bind 127.0.0.1
