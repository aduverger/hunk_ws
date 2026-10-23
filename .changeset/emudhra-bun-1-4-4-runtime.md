---
"hunkdiff": patch
---

Upgrade the bundled Bun runtime to 1.4.4 so Hunk's own HTTPS requests (GitHub review via `hunk gh`, extension fetches) reject certificates issued by the compromised eMudhra intermediate CAs.
