# Draw Steel - Combat Tracker

A Foundry VTT module for the [Draw Steel](https://mcdmproductions.com) system that provides a visual combat tracker overlay with side-based portrait layout and full zipper initiative support.

## Summary

Combat Tracker replaces the default initiative sidebar with a cinematic top-of-screen dock. Party heroes line up on the left, enemies on the right, and a center panel shows round info with turn controls. Groups (squads) display as pill containers with individual captain and minion portraits, all clickable for initiative management.

## Features

### Side-Based Portrait Layout
- **Party vs Enemies** — Heroes on the left, monsters on the right, with a center info panel
- **Zipper initiative highlighting** — The side that should act next gets a green glow
- **Turn labels** — Shows "Hero's Turn" or "Monsters' Turn" based on the active combatant

### Visual Turn States
- **Active** — Orange pulsing ring on the currently acting combatant
- **Can Act** — Green border for combatants with remaining initiative
- **Done** — Grayed out for combatants who have used their turn
- **Defeated** — Dark with red border for defeated combatants

### Squad / Group Display
- **Captain portrait** — Larger circle with gold border inside a pill container
- **Minion portraits** — Smaller circles in 2x2 grid clusters, grouped by name
- **Group name & stamina** — Displayed below the pill with cumulative HP across all members
- **Individual member states** — Each mini-portrait shows its own green/orange/gray state
- **Pill click** — Click the group pill to toggle the entire group's act/restore state

### Initiative Management
- **Click to pass turn** — Click any can-act portrait to set them as active without consuming their initiative
- **Click to restore** — Click any done portrait to restore their initiative
- **End Turn button** — Properly ends the current turn and marks the combatant as done
- **Next Round** — Appears when all combatants have acted (GM only)

### Auto-Defeat
- Monsters are automatically marked defeated when stamina reaches 0
- Defeated status is automatically removed if stamina is restored above 0

### Tooltip System
- **Hover tooltips** — Detailed floating tooltip with stamina, heroic resource, surges, and characteristics
- **Two-column layout** — Stats on the left, characteristics on the right with a divider
- **GM-only monster stats** — Monster tooltips (stamina, level, role, EV) are hidden from players
- **Configurable** — Can be toggled off in module settings

### Additional Features
- **Token hover integration** — Hovering a portrait highlights the corresponding token(s) on the canvas
- **Right-click to open sheet** — Right-click any portrait to open the actor or group sheet
- **Mouse wheel scrolling** — Scroll horizontally through side containers with the mouse wheel
- **Hide/Show drawer** — Collapse the dock to a thin toggle bar, preserving screen space
- **GM controls** — Previous/Next round buttons, End Combat button

## Installation

Install via Foundry VTT's module browser by searching for **"Draw Steel - Combat Tracker"**, or paste the manifest URL into the Install Module dialog:

```
https://github.com/OmerCora/draw-steel-combat-tracker/releases/latest/download/module.json
```

## Compatibility

| | Version |
|---|---|
| **Foundry VTT** | v13+ (verified 13.351) |
| **Draw Steel System** | v0.9.0+ (verified 0.11.1) |

## License

Module code is licensed under [MIT](LICENSE).

This module uses content from *Draw Steel: Heroes* (ISBN: 978-1-7375124-7-9) under the [DRAW STEEL Creator License](https://mcdm.gg/DS-license).

## Support

If you find this module useful, consider supporting development:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/G2G263V03)

---

*Draw Steel - Combat Tracker is an independent product published under the DRAW STEEL Creator License and is not affiliated with MCDM Productions, LLC. DRAW STEEL &copy; 2024 MCDM Productions, LLC.*
