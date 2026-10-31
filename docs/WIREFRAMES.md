# Wireframes

Low-fidelity layouts for the four screens (desktop first, mobile notes under each). Everything is linked: places, species and severity badges navigate between screens.

## Map
```
+----------------------------------------------------------------------+
| [Elanco] UK Tick Surveillance                 ( Map | Insights | Learn | Report ) |
+----------------------------------------------------------------------+
| +--------------------------+                    +-------------------+ |
| | From [..] To [..] Place v|                    | Manchester   Close| |
| | (o)Fox (o)Marsh (o)... x |                    | North West        | |
| | 1,000 sightings, 14 places|     (UK map)      | [ Recent activity: Moderate ] |
| +--------------------------+   o  O  o          | 72 | 23 Dec 2024 | 6 |
|                              O (ring = level)   | [Directions][Share][Report here][View insights] |
| Map key: size / colour / ring   o               | Timeline chart (hover)  |
|                                                 | Species -> Learn links  |
|                                                 | Latest sightings (photos)|
+----------------------------------------------------------------------+
```
Mobile: filters collapse to the top card; the detail panel becomes a draggable bottom sheet.

## Insights
```
Title                                   [ Place v ]  [Level] Open on map ->
[ sightings | most reports | top species | latest report ]
Sightings over time (Weekly | Monthly | Yearly)  hover / arrow keys
[ Species mix (-> map) ]  [ By region ]
By place: Name  region  [Level]  count   (each row -> map)
```

## Learn
```
Know your ticks
[card art][card art][card art]   click -> expands to sheet:
Name, latin, hero art, how to recognise, facts, Pet concern [Level],
season chart, top places (-> map), [Report this tick] [See on map]
Seasonal activity (place picker)  |  Prevention tips (3 groups)
```

## Report
```
What did you find?  [tile][tile][tile][tile][tile]   note: latin, identify, Pet concern, Full guide ->
Where and when      ( Nearest city v ) ( Date )       note: Recent activity in <city> [Level], See on map ->
Photo (drop zone / preview)    Notes (0/500)
------------------------------ sticky bar: [ Submit sighting ] -------
Success: summary, warnings (e.g. possible duplicate), [View on map] [Report another]
```

## Severity
- **Pet concern** (per species): Low / Moderate, from the species guide. Indicative only.
- **Recent activity** (per place): places ranked by sightings in the final 12 months of the data; top third High, middle Moderate, rest Low. Shown as a ring on the map, a badge in panels, and in the Insights place list. Always paired with a text label and bar-height icon, never colour alone.
