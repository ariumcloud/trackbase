---
id: 2
title: Shared auth requires an explicit product boundary
status: open
type: internal
skill: []
proposes_skill: []
siblings_checked: none — instance-specific product architecture
area: multi-product authorization and administrative support
date: 2026-09-08
session_context: Adding a platform administration area to a Trackbase installation that shares Supabase Auth with another product.
parked_until:
resolved:
resolution:
reference: supabase/migrations/20260908222359_platform_admin.sql
---

**Issue:** An administrator directory built from shared authentication could expose accounts belonging to a different product, and workspace ownership alone does not prove platform-admin authority.

**Suggested improvement:** Keep platform-admin membership in a dedicated table, scope customer discovery to product membership or an explicit product marker, return only a small profile DTO, and require audited server-side mutations.

**Principle:** Shared identity infrastructure needs an explicit product boundary before support tooling can safely inspect or change customer data.
