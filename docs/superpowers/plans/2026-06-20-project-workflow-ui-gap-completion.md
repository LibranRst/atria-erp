# Project Workflow UI Gap Completion

Implementasi dilakukan berurutan: canonical quotation bundle dan calculator, workflow stock yang aman, projection history/revision, lalu UI mobile dan dokumentasi. Approved RAB existing tetap immutable dan legacy `is_bundle` dipertahankan sebagai compatibility field.

## Changes

- Tambahkan Named Bundle dengan member RAB item, commercial price sendiri, lifecycle draft-only, dan total calculator bersama untuk UI, approval, serta Change Order.
- Tambahkan Change Order/revision timeline yang dapat dibaca seluruh role project.
- Tambahkan Reserve, Use, Return, dan Waste pada tab Stok; Waste serta Return memakai invariant project cost dan audit transactional.
- Tambahkan stale-source projection, refresh feedback, dan sticky unsaved status pada draft RAB.
- Selaraskan workflow guide dengan UI aktual.

## Verification

- Targeted Bun tests untuk total bundle, validation, stock return/waste, revision, dan RBAC.
- TypeScript, ESLint, production build, migration smoke, dan browser verification 320/390/430px.
