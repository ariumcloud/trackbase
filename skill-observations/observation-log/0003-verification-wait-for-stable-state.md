---
id: 3
title: Wait for a stable client state before reading production metrics
status: open
type: open-source
skill: [vercel:verification]
proposes_skill: []
siblings_checked: none — no family registry present; this is a verification workflow observation
area: browser verification timing
date: 2026-09-10
session_context: Verifying a production campaign dashboard after deploying a fix that loads tracking events server-side.
parked_until:
resolved:
resolution:
reference:
---

**Issue:** A first accessibility snapshot taken immediately after a production reload showed zero event-derived metrics, while the same page showed the correct values after the client finished synchronizing and the component recalculated.

**Suggested improvement:** In full-story browser verification, wait for the page's loading/synchronizing indicator to settle and take a second semantic snapshot before treating a metric as missing. Keep the first snapshot as timing evidence rather than as a definitive failure.

**Principle:** A browser assertion about asynchronously hydrated data must be made only after the UI reaches a stable state, not merely after the navigation request returns.
