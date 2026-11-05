# Return tool answer: match the result as sent, kept beside the stamped hash (2026-11-05)

Item: fix-return-tool-answer. A two-way door, decided by the building thread as the person's stand-in when the item
went ready.

## The question

After the harness hook accepts a return, the return tool (plugins/harness/scripts/return-tool.mjs) checks that the
run's result.json holds this result, by comparing sha256 of the arguments it got with result.json's `hash`. That hash
is of the stamped result (accept() adds key, branch, checkout, gates and green to each PR ref), so every accepted
return with a PR ref is answered "not accepted" and the agent retries into already-returned. How should the tool
recognise the call the hook accepted?

## Options

1. **By tool use id.** accept() already stores `toolUseId` in result.json. The MCP server would compare it with the
   id of the call it is serving. But an MCP `tools/call` carries only the tool's name and arguments; Claude Code may
   add a `_meta` with its tool use id, and no probe in this repo has shown that it does. Building on it would add a
   platform fact nobody has seen, for the one case the hash already covers.
2. **By a hash of the result as sent, kept beside the stamped one.** accept() writes `sent`, a hash of the result the
   agent sent, into result.json next to `hash`. The tool hashes its arguments the same way and accepts on either
   match. No platform fact, one more field, and the tool stays free of engine code.

## Decision

Option 2. `sent` is sha256 of the result serialised with its object keys sorted at every depth, so a change of key
order between the hook's tool_input and the server's arguments cannot split them; both sides use the same few lines
(the server may not import the engine, verify/engine-host/plugin-tools.test.mjs). Only when result.json has no `sent`
does the tool fall back to `hash` matched against the plain serialisation, so a result.json written before this change, and done verifier fixtures that write
only `hash`, are answered as before. Nothing else changes: the checks, the stored result, its blob and the
result.stored row are as they are. The fallback is not used when `sent` is there, so
sending the stamped result itself is not accepted.

A result whose PR refs the host stamped then gets "accepted" for the same call the hook let through. A different
result for that run still gets "not accepted", and so does a call no hook saw.
