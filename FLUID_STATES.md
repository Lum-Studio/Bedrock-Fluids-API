# Understanding Fluid Block States

The custom fluid simulation is controlled by four block states that work together. They are divided into two categories: **Logic States** (controlling behavior) and **Visual States** (controlling appearance).

---

## 1. Logic States (The "Brains")

These states control how the fluid actually spreads and flows.

### `lumstudio:depth`
- **Purpose:** Represents the fluid's "strength" or "pressure." It determines how far the fluid can spread from a source.
- **How it Works:** A source block has a depth of `7`. As it spreads, the new fluid block gets a depth of `6`, the next one `5`, and so on. A fluid with `depth: 0` cannot spread further.
- **Values:** Integer from `0` to `7`.

### `lumstudio:fluidMode`
- **Purpose:** Determines if the fluid should be flowing downwards or spreading sideways.
- **How it Works:**
    - **`dormant`**: The default state. The fluid will spread horizontally.
    - **`active`**: The "falling" state. This is triggered when there is air below the fluid. An active fluid will only flow downwards and will not spread horizontally.
- **Values:** `"active"`, `"dormant"`.

---

## 2. Visual States (The "Looks")

These states control the fluid's appearance based on the logic states. The values for these states **must** match the models defined in the resource pack.

### `fluid_state`
- **Purpose:** Controls the 3D model of the fluid, making it look shorter as it gets further from the source.
- **How it Works:** The logical `depth` (0-7) is mapped to a visual state. For example, a depth of `7` becomes `full`, `6` becomes `flowing_0`, and so on. Each of these states corresponds to a different 3D model with a different height.
- **Values:** `"full"`, `"flowing_0"`, `"flowing_1"`, ..., `"flowing_5"`, `"empty"`.

### `slope`
- **Purpose:** Controls the visual slope of the fluid's surface, making it look like it's flowing in a specific direction.
- **How it Works:** The script checks for adjacent air blocks. If there's air to the north, the slope becomes `"n"`. If there's no adjacent air, the slope is `"none"`. This is used to select the correct model or texture rotation.
- **Values:** `"none"`, `"n"`, `"e"`, `"s"`, `"w"`, and diagonals (`"ne"`, `"nw"`, `"se"`, `"sw"`).
