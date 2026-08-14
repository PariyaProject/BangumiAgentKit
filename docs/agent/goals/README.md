# Goal Profiles

Active Harness V3 profiles are concise mode selectors:

- [`AUTONOMOUS_EVOLUTION.md`](AUTONOMOUS_EVOLUTION.md): create/resume one Outer
  Run Issue, resume an active Epoch or select the next coherent safe Epoch, and
  continue until a governed stop.
- [`EXECUTE_EPOCH.md`](EXECUTE_EPOCH.md): execute one explicitly selected Epoch
  and never select another.

Both profiles reference the product direction in
[`../PRODUCT_CHARTER.md`](../PRODUCT_CHARTER.md) and the only canonical detailed
execution policy in [`../HARNESS.md`](../HARNESS.md). Profiles do not store
runtime progress or copy lifecycle mechanics.

Files with legacy V2 names remain short compatibility pointers only.
