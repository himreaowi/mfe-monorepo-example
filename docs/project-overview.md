# Project overview

<!--
  PURPOSE
  Evergreen product framing for humans and agents (IDE-agnostic).
  Update after sessions that change product intent (same habit as
  coding-conventions.md / ui-context.md / AGENTS.md).

  RELATED DOCS (do not duplicate their jobs here)
  - docs/coding-conventions.md → how to write code
  - docs/ui-context.md         → tokens, theming, components
  - AGENTS.md                  → short agent checklist
  - .specify/memory/constitution.md → engineering principles
  - docs/architecture.md       → zones, runtime, decisions D1–D8
  - specs/<feature>/spec.md → per-feature requirements when using Speckit
-->

## What it is

_TODO: Describe the actual product this repository is building (2–4
sentences). Focus on user value and outcomes, not template mechanics._

## Who it is for

- **Primary users:** _TODO_
- **Secondary users / stakeholders:** _TODO_
- **Assumptions about user skills or context:** _TODO_

## Problem / why it exists

_TODO: What pain does this product solve? What happens if this product does not
exist? Keep this short and product-facing._

## Goals

1. _TODO: Goal one (specific and measurable)._
2. _TODO: Goal two._
3. _TODO: Goal three._

## Core flows

1. _TODO: Core flow 1 (actor → steps → successful outcome)._
2. _TODO: Core flow 2._
3. _TODO: Core flow 3._
4. _TODO: Core flow 4 (optional)._

Detail and acceptance criteria for new work stay in `specs/<feature>/spec.md`
when using Speckit.

## Zones and apps

<!--
  One row per app (generated with pnpm gen:shell / gen:remote). `pnpm -s apps` lists them.
-->

| Zone     | App              | Type / access                       | Owner  | Purpose |
| -------- | ---------------- | ----------------------------------- | ------ | ------- |
| intranet | `shell-intranet` | shell                               | _TODO_ | _TODO_  |
| _TODO_   | _TODO_           | remote, public / private / external | _TODO_ | _TODO_  |

External (vendor) modules: _TODO: vendor, product, integration (adapter / iframe), contact._

## Features

### Feature category one

- _TODO: Feature description._
- _TODO: Feature description._

### Feature category two

- _TODO: Feature description._
- _TODO: Feature description._

## Scope

### In scope (product)

- _TODO: What this project intentionally includes now._
- _TODO: Additional in-scope capability._

### Out of scope

- _TODO: Explicit non-goal 1._
- _TODO: Explicit non-goal 2._
- _TODO: Explicit non-goal 3._

## Success criteria

1. _TODO: Specific, verifiable condition 1._
2. _TODO: Specific, verifiable condition 2._
3. _TODO: Specific, verifiable condition 3._

## Glossary

| Term        | Meaning            |
| ----------- | ------------------ |
| _TODO term_ | _TODO definition._ |
| _TODO term_ | _TODO definition._ |
| _TODO term_ | _TODO definition._ |

## Links

| Doc                                                   | Role                        |
| ----------------------------------------------------- | --------------------------- |
| [README.md](../README.md)                             | Quick start & scripts       |
| [docs/architecture.md](./architecture.md)             | Zones, runtime, decisions   |
| [docs/coding-conventions.md](./coding-conventions.md) | Coding conventions          |
| [docs/ui-context.md](./ui-context.md)                 | UI / tokens / components    |
| [AGENTS.md](../AGENTS.md)                             | Agent must-follow checklist |
| [Constitution](../.specify/memory/constitution.md)    | Engineering principles      |
| [Theming contract](./contracts/theming.md)            | Theme / token rules         |
| [A11y contract](./contracts/a11y-wcag.md)             | WCAG 2.2 AA                 |
