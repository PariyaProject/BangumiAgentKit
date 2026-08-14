# Execute Epoch Goal Profile

Read [`../PRODUCT_CHARTER.md`](../PRODUCT_CHARTER.md) and
[`../HARNESS.md`](../HARNESS.md), then execute this profile.

- Mode: `EXECUTE_EPOCH`
- Primary: GPT-5.6 Luna `max` (`xhigh` availability fallback only)
- Generic subagents: `0`
- Expected Sol for a reviewed Epoch: `1`
- Automatic Sol maximum: `2`

Execute the one explicitly selected Epoch PR through engineering, Scope
Closure, adversarial preflight, Candidate/CI, review, and the default
PASS-to-merge cleanup path. Do not discover or select another Epoch.

If no specific V3 Epoch PR is selected, or its GitHub control state cannot be
reconstructed, stop truthfully rather than inventing one or falling back to
legacy tracked runtime files.
