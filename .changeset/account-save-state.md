---
"hunkdiff": patch
---

Store document save coordination in the account's Hunk state directory without creating a `.hunk` project marker in the user home. This preserves project discovery and reload bounds for directories beneath the home, including Windows temporary files.
