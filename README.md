# Draw Steel - Combat Tracker

[![Downloads](https://img.shields.io/github/downloads/OmerCora/draw-steel-combat-tracker/total?label=Downloads&color=4aa94a)](https://github.com/OmerCora/draw-steel-combat-tracker/releases)
[![Latest Version Downloads](https://img.shields.io/github/downloads/OmerCora/draw-steel-combat-tracker/latest/total?label=Latest%20Version&color=4aa94a)](https://github.com/OmerCora/draw-steel-combat-tracker/releases/latest)
[![Foundry Installs](https://img.shields.io/endpoint?url=https://foundryshields.com/installs?packageName=draw-steel-combat-tracker)](https://foundryvtt.com/packages/draw-steel-combat-tracker)

A Foundry VTT module for the [Draw Steel](https://mcdmproductions.com) system that provides a visual combat tracker overlay with side-based portrait layout and full zipper initiative support.

## Summary

Combat Tracker replaces the default initiative sidebar with a stationary dock. Party heroes line up on the left, enemies on the right, and a center panel shows round info with turn controls. Groups (squads) display as pill containers with individual captain and minion portraits, all clickable for initiative management.

<img width="1133" height="134" alt="Screenshot 2026-04-06 184842" src="https://github.com/user-attachments/assets/13787e0e-c4a9-4b6b-ab65-e620c9673a42" />


## Details

### Side-Based Portrait Layout
- **Party vs Enemies** — Heroes on the left, monsters on the right, with a center info panel
- **Zipper initiative highlighting** — The side that should act next gets a green glow
- Monsters are automatically marked defeated when stamina reaches 0

### Squad / Group Display
- **Captain portrait**: Larger circle with gold border inside a pill container
- **Minion portraits**: Smaller circles in 2x2 grid clusters, grouped by name
- **Group name & stamina**: Displayed below the pill with cumulative HP across all members (GM only)
- **Individual member states**: Each mini-portrait shows its own green/orange/gray state
- **Pill click**: Click the group pill to toggle the entire group's act/restore state

### Initiative Management
- **Click to pass turn**:  Click any can-act portrait to set them as active without consuming their initiative
- **Click to restore**:  Click any done portrait to restore their initiative
- **End Turn button**:  Properly ends the current turn and marks the combatant as done
- **Next Round**: Appears when all combatants have acted (GM only)

### Tooltip
- **Hover tooltips**  Detailed floating tooltip with stamina, heroic resource, surges, and characteristics
- **Two-column layout**: Stats on the left, characteristics on the right with a divider
- **GM-only monster stats**: Monster tooltips (stamina, level, role, EV) are hidden from players
- **Configurable**: Can be toggled off in module settings

<img width="174" height="275" alt="Screenshot 2026-04-06 184909" src="https://github.com/user-attachments/assets/40cb423a-ded6-425f-ac8b-277667962ea0" />

### Additional Features
- **Right-click to open sheet**: Right-click any portrait to open the actor or group sheet
- **Hide/Show drawer** — Collapse the dock to a thin toggle bar, preserving screen space

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
