# Working Rules

- Before each task, inspect the relevant files on the target branch and read [PROJECT.md](PROJECT.md). For implementation, also read [FEATURES.md](FEATURES.md) and [SECURITY_GUIDE.md](SECURITY_GUIDE.md). Confirm exact repository paths and links before using them.
- Do not fill gaps with guesses. Ask focused questions when requirements, behavior, dependencies, deployment, or URLs are unclear.
- Before changing files or GitHub state, describe the exact changes, affected paths, logic, and URL or route impact; wait for explicit approval. Approval applies only to the described changes.
- Keep edits and code concise. Avoid duplicate logic, repeated instructions, unnecessary dependencies, and unrelated changes.
- Preserve VulnFlow's evidence-first limits: reference checks do not establish exploitability; code changes do not establish remediation; duplicate suggestions require human review.
- Apply the security controls in SECURITY_GUIDE.md. Check that every added or changed link, URL, API route, and file reference points to the intended target. Verify relevant behavior with existing project checks where available; do not add or run tests unless asked.
- After approved edits, summarize changed paths and what was checked. Do not claim a check passed unless it was actually performed.
