#!/usr/bin/env bash
# Trial gh wrapper (temporary: placed first on PATH for the trial, removed after). Inside the trial folder, and only
# while its SHIM_ACTIVE file exists, gh is the trial stand-in; everywhere else it is the real gh, untouched.
T=/home/user/trial-fail
if [ -e "$T/SHIM_ACTIVE" ]; then
  case "$(pwd -P)/" in
    "$T"/*) TRIAL_DIR="$T" exec node "$T/shim/gh.mjs" "$@" ;;
  esac
fi
exec /usr/local/bin/gh "$@"
