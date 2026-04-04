"""
Launcher for the Coqui TTS server.
Sets COQUI_TOS_AGREED before importing TTS so the model can load without
requiring the user to manually set the env variable in their shell.
Run via: .venv/Scripts/python.exe scripts/tts-serve.py [--port 5002]
"""
import os
import runpy
import sys

os.environ["COQUI_TOS_AGREED"] = "1"

# Default args — can be overridden by passing CLI args to this script
model = "tts_models/multilingual/multi-dataset/xtts_v2"
port = "5002"

# Allow overrides: python tts-serve.py --model_name <m> --port <p>
args_in = sys.argv[1:]
new_argv = ["tts-serve"]
i = 0
while i < len(args_in):
    arg = args_in[i]
    if arg in ("--model_name", "--model") and i + 1 < len(args_in):
        model = args_in[i + 1]
        i += 2
    elif arg == "--port" and i + 1 < len(args_in):
        port = args_in[i + 1]
        i += 2
    else:
        new_argv.append(arg)
        i += 1

sys.argv = [new_argv[0], "--model_name", model, "--port", port] + new_argv[1:]

runpy.run_module("TTS.server.server", run_name="__main__")
