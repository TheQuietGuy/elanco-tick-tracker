# Accessibility

Target: WCAG 2.2 AA for the features in this MVP.

## What is built in
- **Structure and navigation:** landmarks (header, nav, main), skip link, a page title and spoken announcement on each page change, focus moved to the page on navigation, visible focus rings.
- **Keyboard:** everything works without a mouse. Shortcuts: `1`-`4` pages, `/` place picker, `?` guide, `Esc` closes panels. Map places are real buttons (labels), charts read point-by-point with the arrow keys, the tips slideshow uses left/right keys.
- **Map:** every place has a visible text label, not just a colour. Selected place gets a filled label, a pulsing halo and an `aria-pressed` state. Severity is shown by ring colour plus a text label and bar icon, never colour alone.
- **Charts:** hover, touch and keyboard tooltips, a text summary (`aria-label`), live announcements, and a "View data as a table" alternative for every chart.
- **Forms:** programmatic labels, inline errors tied with `aria-describedby`, an error summary that receives focus, non-colour error icons.
- **Display settings (person icon in the header):** text size (100/115/130%), high contrast, reduced motion, always-visible navigation. Saved on the device. System dark mode and `prefers-reduced-motion` / `prefers-contrast` / `prefers-reduced-transparency` are honoured.
- **Touch:** 44px targets on touch devices, swipeable slideshow, bottom sheet on phones.
- **Motion:** no autoplay; the intro has Skip, Esc, muted-by-default sound and a reduced-motion version.

## How it was checked
Automated headless-browser runs (keyboard paths, settings, shortcuts, table alternatives, no console errors) and screenshots at desktop and phone widths in light and dark themes. Not yet done: a screen-reader pass (VoiceOver/NVDA) and an automated axe audit. Both are recommended before production.

## Known gaps
- Species illustrations are decorative drawings with text alternatives; identification relies on the written description.
- On very small screens some map labels are hidden to avoid overlap; they remain reachable by Tab and via the place picker.

## Options for different needs

Open the person icon in the top bar (**Display and accessibility**). Everything is remembered on the device.

- **Text size** (three steps), **High contrast**, **Reduced motion** (also follows the system setting), **Always show navigation**.
- **Easy to read**: wider letter and word spacing, taller lines and an open sans-serif face (helps dyslexia and low vision).
- **Colour-blind safe** palette (Okabe-Ito) for species and activity colours. Meaning is never carried by colour alone; levels and species always have text labels.
- **Always skip** the welcome animation.
- **Listen**: species summaries can be read aloud with the browser's built-in speech (nothing is sent anywhere).
- **Download CSV** of sightings (respects the chosen place) for use in a spreadsheet or screen-reader-friendly tools. Cells are escaped so spreadsheets never run them as formulas.
- **Print this guide** on the Learn page uses a clean print layout.
- A notice appears when the device goes offline.
