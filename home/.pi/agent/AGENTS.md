# Global agent instructions

## Classification in codemode

For large batches requiring semantic labels or scores, consider an available
classifier such as Jev via `models.classify()`. Prefer plain JavaScript for
deterministic filtering and direct reasoning for small batches or nuanced decisions.
Discover models with `models.getAvailableOfType("classifier")`; do not hardcode
provider IDs. Check `stopReason`, preserve source IDs, and verify consequential
classifications. Only send data to providers permitted for that data.
