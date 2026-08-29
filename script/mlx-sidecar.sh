#!/usr/bin/env bash
set -euo pipefail

# Launches Apple Metal MLX-LM local server sidecar using uv
MODEL="${1:-mlx-community/Qwen2.5-Coder-7B-Instruct-4bit}"
PORT="${2:-8080}"

echo "Starting Apple Metal MLX-LM sidecar with model: $MODEL on port: $PORT..."
echo "OpenCode provider: mlx (URL: http://127.0.0.1:${PORT}/v1)"

uvx --with mlx-lm python3 -m mlx_lm.server --model "$MODEL" --port "$PORT"
