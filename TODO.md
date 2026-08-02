# Fix White Box Height — Task List

## Steps
- [x] Analyze the task & read relevant files (index.html, style.css)
- [x] Confirm plan with user
- [x] 1. Remove `margin: 0 auto` from `.card` rule in style.css so the body's flex `align-items: stretch` fills viewport height
- [x] 2. User feedback: card should cover the WHOLE page — made `.card` full-bleed:
  - `body` padding set to `0` (removes beige border around the card)
  - `.card` width set to `100%` / `max-width: 100%` (fills full width, no 960px cap)
  - `.card` `min-height: 100vh` (fills full height)
  - `border-radius: 0`, `box-shadow: none`, `border: 0` (no rounded corners / shadow reveal edges)
  - Mobile media query border-radius also set to `0`

