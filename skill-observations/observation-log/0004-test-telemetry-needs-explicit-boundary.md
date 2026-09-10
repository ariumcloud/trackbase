---
id: 4
title: Test telemetry needs an explicit boundary before it reaches production metrics
status: open
type: open-source
skill: [task-observer]
proposes_skill: []
siblings_checked: none — no family registry present; this is a data-quality boundary observation
area: telemetry and dashboard data quality
date: 2026-09-10
session_context: Reviewing a production lead radar that included internal tracker validation sessions when all offers were selected.
parked_until:
resolved:
resolution:
reference:
---

**Issue:** Internal tracker validation events used recognizable UTM/session markers but were stored in the same event table as production traffic, so an all-offers radar displayed them as real visitors.

**Suggested improvement:** Mark validation events explicitly at ingestion (for example with a durable `is_test` field) and apply the same exclusion predicate in every aggregate and visualization. Keep the current marker-based filter as a compatibility guard while legacy rows are cleaned up.

**Principle:** Test traffic should be classified at the data boundary, not inferred only by individual dashboards after it has already affected counts.
