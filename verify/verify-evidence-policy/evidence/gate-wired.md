# gate-wired

Command: `node --test verify/verify-evidence-policy/gate-wired.test.mjs` from the PR checkout (BASE_SHA from the
workflow, else `git merge-base HEAD origin/main`); by hand, `BASE_SHA=3946736 node scripts/gates/pr-gate.mjs evidence`
on build/verify-evidence-policy with this verdict and evidence committed.

Excerpt (2/2 pass): .github/workflows/verdict.yml gates job, after "no stubs" and "contract freeze":
"- name: evidence under verify/ is small and is not a test listing / if: ${{ !cancelled() }} /
run: node scripts/gates/pr-gate.mjs evidence". On the branch: "evidence gate passed", exit 0, with the files under
verify/verify-evidence-policy/ (each under 8 KB) added. Also on GitHub: #197's gates run 42468035181 at 7f52c6f6e724ab8af45cddf35cbde0847016f05e passed
every step but verdict ("no verify/verify-evidence-policy/verdict.json at the head sha").

Against main: 0 of 2 pass.

The test needs no git history: it commits the 14 files of verify/verify-evidence-policy/ onto a temp-repo base that
lacks them and runs the gate there, so it passes in ci.yml's depth-1 checkout (checked in a `git clone --depth 1`
with no origin/main: 2/2).
