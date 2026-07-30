# ShareSight Brand Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visible “林麝研集” brand with “ShareSight” while preserving the existing site, URL, layout, and features.

**Architecture:** Keep the current client page and dynamic metadata structure. Change only user-facing brand strings in `app/page.tsx` and `app/layout.tsx`, then verify the rendered response and production build before publishing a new version to the existing Sites project.

**Tech Stack:** React 19, Next.js 16, vinext, Node test runner, OpenAI Sites.

## Global Constraints

- The existing Sites project and URL must remain unchanged.
- Login, registration, roles, uploads, folders, preview, move, delete, and download behavior must remain unchanged.
- Page layout, colors, and the forest musk deer silhouette must remain unchanged.
- The visible brand name must be exactly `ShareSight`.

---

### Task 1: Rename the visible brand

**Files:**
- Create: `tests/brand.test.mjs`
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: the existing vinext worker entrypoint at `dist/server/index.js`.
- Produces: rendered HTML whose title and visible page payload use `ShareSight`.

- [ ] **Step 1: Write the failing rendered-brand test**

```javascript
import assert from "node:assert/strict";
import test from "node:test";

test("renders the ShareSight brand", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("brand-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /<title>ShareSight｜团队资料库<\/title>/);
  assert.match(html, /ShareSight/);
  assert.doesNotMatch(html, /林麝研集/);
});
```

- [ ] **Step 2: Build and run the test to verify it fails**

Run: `npm run build && node --test tests/brand.test.mjs`

Expected: FAIL because the rendered title and page still contain `林麝研集`.

- [ ] **Step 3: Apply the minimal brand rename**

In `app/page.tsx`, replace each visible `林麝研集` brand label with `ShareSight`.

In `app/layout.tsx`, use:

```typescript
title: "ShareSight｜团队资料库"
```

and:

```typescript
title: "ShareSight｜让每一次分享都有迹可循"
```

- [ ] **Step 4: Rebuild and verify the test passes**

Run: `npm run build && node --test tests/brand.test.mjs`

Expected: PASS with one test and zero failures.

- [ ] **Step 5: Publish to the existing Sites project**

Package the verified build, save one new version against the existing `project_id`, deploy it with the current owner-only access policy, and wait for deployment status `succeeded`.

- [ ] **Step 6: Open and hand off the existing GPT-login URL**

Open the deployed URL returned by Sites and provide that exact URL to the user.
