# Convex & Concave Neumorphic Depth Enhancement

Enhance the neumorphic aesthetic across the site by introducing realistic 145-degree surface curvature gradients (convex lighting when resting, concave lighting when pressed). This transforms elements from flat surfaces with drop shadows into physically curved, molded ceramic/stone objects while maintaining seamless editorial canvas backgrounds.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following enhancements were confirmed during the interactive interview:
> - **Surface Curvature**: Implement 145-degree diagonal light gradients (`linear-gradient(145deg, ...)`) to simulate physical surface curvature (convex curvature on elevated elements, inverted concave curvature on pressed elements).
> - **Tactile Inversion**: Buttons, icon rings, and interactive pills will invert their curvature from convex to concave when clicked/pressed, paired with inset shadow transitions.
> - **Seamless Canvas**: Background sections will remain seamless and open without enclosing them in heavy recessed section wells, preserving the site's airy editorial layout.

---

## 1. Overview & Core Concept

- **What It Does**: Upgrades raised and pressed surfaces with simulated physical light deflection. When light hits a raised curved object from the top-left, the top-left surface reflects more photons while the bottom-right falls slightly into shadow. By pairing dual-source shadows with 145° subtle gradient lighting, buttons, cards, and pills look authentically 3D and tangible.
- **Target Audience / Persona**: Visitors exploring K.F. Solheim's portfolio, writings, academic schedule, and curated recommendation library.
- **Key Value**: Delivers the tactile, satisfying physical feel of high-end consumer hardware (like Braun or teenage engineering interfaces) while preserving full accessibility and responsive elegance.

---

## 2. User Experience & Visual Design

### Surface Geometry & Lighting Math
- **Convex Lighting (Extruded / Resting state)**:
  - *Light Mode (`neu-convex`)*:
    `background: linear-gradient(145deg, #f7f3ec, #e2ddd4);`
    Combined with `--neu-shadow-dark` bottom-right and `--neu-shadow-light` top-left.
  - *Dark Mode (`neu-convex`)*:
    `background: linear-gradient(145deg, #1f2329, #15181c);`
    Combined with dark dual ambient shadows.
  - *Primary Accent Button*:
    `background: linear-gradient(145deg, #f02d39, #cc1420);`
- **Concave Lighting (Pressed / Active / Recessed state)**:
  - *Light Mode (`neu-concave`)*:
    `background: linear-gradient(145deg, #e2ddd4, #f7f3ec);`
    Combined with inner debossed shadows (`neu-inset`).
  - *Dark Mode (`neu-concave`)*:
    `background: linear-gradient(145deg, #15181c, #1f2329);`
    Combined with dark inner debossed shadows.
  - *Primary Accent Pressed*:
    `background: linear-gradient(145deg, #cc1420, #f02d39);`

### Interactive Micro-Interactions
- **Button Press Physicality**: On mouse-down / tap (`:active`), buttons transition from `neu-convex` to `neu-concave` with zero layout jitter, delivering an instant physical "click" feedback.
- **Category Filter Tabs**: Inactive pills have a gentle convex curve; clicking activates an inverted concave depression in signature accent color.
- **Card Bezel Highlights**: Media and collection cards gain a delicate convex frame border that matches the light source angle.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: CSS Variables for Gradient Light Stops**
  - *Chosen Approach*: Define `--neu-convex-start`, `--neu-convex-end`, `--neu-concave-start`, and `--neu-concave-end` inside `:root` and `.dark` in `src/index.css`.
  - *Why*: Allows global tuning and instant synchronization with light/dark theme toggling without repetitive inline gradients.

- **Decision 2: Subtlety Over Skeuomorphic Slop**
  - *Chosen Approach*: Gradient stops differ by only $\approx 4\text{–}6\%$ luminance delta.
  - *Why*: Prevents garish, plastic-looking 2000s glossy bubble buttons. The effect reads as refined matte ceramic or sandblasted anodized metal.

---

## 4. Technical Architecture & Component Mapping

```
┌─────────────────────────────────────────────────────────────┐
│                 Curved Neumorphic Engine                    │
│                     (src/index.css)                         │
│                                                             │
│   Convex:  linear-gradient(145deg, High-Lit, Low-Lit)       │
│   Concave: linear-gradient(145deg, Low-Lit, High-Lit)       │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      Interactive UI Kits     │ │     Media & Content Cards  │
│  (Button, Sort, Categories)  │ │  (Recommendations, CV,    │
│                              │ │   Writings, UserPage)      │
│  - neu-convex idle state     │ │                            │
│  - neu-concave pressed state │ │  - neu-convex card bezels  │
│  - Inset category wells      │ │  - Convex icon discs       │
└──────────────────────────────┘ └────────────────────────────┘
```

### Component Updates

1. **`src/index.css`**:
   - Add `.neu-convex` and `.neu-concave` utility classes for light and dark themes.
   - Configure gradient stops in `:root` and `.dark`.
2. **`src/components/ui/Button.tsx`**:
   - Equip all button variants with `.neu-convex` idle states and `.neu-concave` active states.
3. **`src/components/Recommendations.tsx` & `PrivateRecommendations.tsx`**:
   - Apply `.neu-convex` to category buttons and media cards.
   - Apply `.neu-concave` to active category selections and search field recesses.
4. **`src/components/Home.tsx` & `App.tsx`**:
   - Apply convex curvature to hero buttons, theme toggle, wrench button, and social icon discs.
