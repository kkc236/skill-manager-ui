# Skill Deck Workbench Redesign

Date: 2026-06-19

## Goal

Turn Skill Deck from a card-heavy demo into a usable local skill control console. The product value is:

- Local Skill vault.
- Codex skill activator.
- Scene preset manager.

The primary workflow should be obvious within seconds: choose a scene, manage skill files, inspect or edit one skill, and activate or close skills without thinking about filesystem paths.

## Core User Jobs

1. Start a working scene such as thesis writing, frontend development, debugging, automation, or Japanese learning, and have the matching skills activated together.
2. Understand one skill quickly by reading its description and `SKILL.md` comfortably.
3. Activate, close, sync, and batch-switch skills without knowing where Codex stores them.
4. Organize skills like desktop folders: categorize, move between groups, search, rename, edit, and sync.
5. Avoid breaking useful skills through drafts, sync status, conflict warnings, recovery affordances, and recent activity.

## Information Architecture

The console has three primary entrances:

1. Scene Launch
   - Compact preset strip for common working modes.
   - A preset activates a curated group of matching skills.
   - Activation should feel like loading a toolout, with short energy/scan feedback.

2. File Manager
   - Folder-style category rail.
   - Active and Vault lists remain separate.
   - Search and batch selection are always available.
   - Skills can move between groups even after being categorized.

3. Skill Reader / Editor
   - The lower inspector becomes a real reading and editing workspace.
   - Description and `SKILL.md` are shown as upper/lower reading panes inside the inspector.
   - Clicking the secondary pane swaps it into the main reader.
   - The main reader can be resized smoothly by dragging its lower edge or corner.

## Workbench Layout

The main console is a vertical split workbench inspired by iOS Stage Manager. It should feel like a staged workspace: the current task owns the main stage, while the other area remains visible as a compact, recallable preview.

Default management mode:

```text
Skill Manager 80%
Inspector     20%
```

Reading mode:

```text
Skill Manager 20%
Inspector     80%
```

Behavior:

- Clicking the smaller half promotes it to the main 80% stage.
- The demoted half compresses into a readable preview rather than becoming a broken clipped panel.
- The promoted half should visually advance with depth, opacity, and focus, while the background half quiets down.
- The split transition should animate smoothly.
- A divider between the two halves may be dragged to custom proportions.
- The layout should remain usable at 90% browser zoom.
- The two halves should align precisely in Chrome; no visual offset between left and right columns.

Stage Manager principles:

- One dominant stage at a time.
- Background stage stays discoverable, clickable, and useful.
- Promotion feels instant and physical, with a short easing animation.
- No modal interruption for normal switching.
- The system should remember the user's last chosen stage and custom split while the console is open.

## Cover Entry

The cover page is the first entry experience on app open or refresh.

- It is not a sidebar tab replacement for the console.
- The user clicks into the management console from the cover.
- The sidebar can still expose a way back to the cover, but the cover's main role is the app entry.

## Visual Direction

The app should feel like a focused local tool-loading console, not a generic backend table.

- Background video is an atmosphere layer, not decoration only.
- Foreground panels use depth, translucency, softened borders, and clear focus hierarchy.
- Primary work area is visually strong; secondary area is compressed and quiet.
- Remove explanatory text that only describes obvious interactions.
- Reduce dense white blocks and competing tags.

## Motion And Feedback

Animation should explain control, not add noise.

- Hovering interactive items should produce clear cursor/crosshair, border, or glow feedback.
- Enabling a skill should feel like a short energy injection into Active.
- Closing a skill should feel like a compact archive or power-down action.
- Dragging a skill or changing a group should highlight the target folder.
- Batch selection should reveal a floating action bar.
- Scene launch should visually mark matched skills as a loaded set.

## Functional Scope For This Iteration

In scope:

- Vertical 80/20 workbench promotion between manager and inspector.
- Optional draggable workbench split.
- Cover-first app entry.
- Inspector reading panes changed to vertical main/secondary panes.
- Main inspector reader resize only affects the large reader pane.
- Remove visible "click to swap" style helper copy.
- Stronger scene preset strip and batch action feedback.
- Cleaner file manager density and clearer active/vault separation.

Out of scope:

- New network skill marketplace.
- Full drag-and-drop filesystem import from external folders.
- Multi-user sharing.
- Version control history beyond local draft/sync/recent-activity affordances already present or directly implied.

## Test And Verification

Automated tests should cover:

- Cover appears first after reload.
- Clicking enter shows the console.
- Clicking the compact workbench half promotes it to 80%.
- Dragging the divider updates split proportions within safe bounds.
- Inspector swaps description and `SKILL.md` vertically.
- Resizing the main reader changes only the primary reader height.
- Batch selection reveals the bulk action bar.

Browser QA should verify:

- Chrome alignment at 90% zoom.
- No clipped primary controls.
- Smooth split transition.
- Background video remains visible but does not reduce readability.
- No console errors during workbench promotion, reader swap, and reader resize.
