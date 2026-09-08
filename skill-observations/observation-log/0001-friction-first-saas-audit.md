---
id: 1
title: Friction-first SaaS audit
status: open
type: internal
skill: []
proposes_skill: [friction-first-saas-audit]
siblings_checked: none — no family registry or related installed audit skill found
area: product experience audit workflow
date: 2026-09-08
session_context: Auditing a campaign-tracking SaaS from screenshots, live local UI, and source code.
parked_until:
resolved:
resolution:
reference: docs/AUDITORIA_UX.md
---

**Issue:** Product audits can identify visual polish issues while missing the user-costly failure mode: a core object is easy to create but impossible to correct, remove, or confidently deploy.

**Suggested improvement:** Create a reusable audit workflow that begins with the user's desired outcome, tests object lifecycle (create, edit, archive/delete), verifies the primary activation journey, and then compares every visible promise with an executable action.

**Principle:** For operational SaaS, audit the path from intent to a validated real-world action before evaluating feature breadth; irreversible or uncorrectable setup mistakes deserve the highest priority.
