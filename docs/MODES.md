# Built-in mode catalog

The source of truth is `lotus_lamp/data/mode_names.json` plus `mode_categories.json`. This table contains all 213 IDs exposed by `/api/modes` and Presets → Default. Names/categories are inherited catalog metadata, not a decoded firmware renderer or a compatibility guarantee for every lamp.

Default search filters by name, category or number. Tiles select an illustration; Apply effect sends the selected mode and normal speed. Pagination starts with 24 tiles. Custom presets are separate local recipes made from these same IDs.

## Categories

| Internal key | UI label | Entries |
| --- | --- | --- |
| `basic` | Classic | 47 |
| `curtain` | Curtain | 20 |
| `trans` | Transitions | 20 |
| `water` | Water | 18 |
| `flow` | Flow | 24 |
| `tail` | Trails | 16 |
| `run` | Forward | 34 |
| `runback` | Reverse | 34 |

## All programs

IDs are zero-based; library `get_mode_by_category_index(category, index)` uses a one-based category index. Program 0 is Auto Play.

| ID | Name | Category |
| --- | --- | --- |
| 0 | Auto Play | `basic` |
| 1 | Magic Forward | `basic` |
| 2 | Magic Back | `basic` |
| 3 | 7-Color Trans | `trans` |
| 4 | 7-Color Trans Back | `trans` |
| 5 | R-G-B Trans | `trans` |
| 6 | R-G-B Trans Back | `trans` |
| 7 | Y-C-P Trans | `trans` |
| 8 | Y-C-P Trans Back | `trans` |
| 9 | 6-Color to Red | `trans` |
| 10 | 6-Color to Red Back | `trans` |
| 11 | 6-Color to Green | `trans` |
| 12 | 6-Color to Green Back | `trans` |
| 13 | 6-Color to Blue | `trans` |
| 14 | 6-Color to Blue Back | `trans` |
| 15 | 6-Color to Cyan | `trans` |
| 16 | 6-Color to Cyan Back | `trans` |
| 17 | 6-Color to Yellow | `trans` |
| 18 | 6-Color to Yellow Back | `trans` |
| 19 | 6-Color to Purple | `trans` |
| 20 | 6-Color to Purple Back | `trans` |
| 21 | 6-Color to White | `trans` |
| 22 | 6-Color to White Back | `trans` |
| 23 | 7-Color Tail | `tail` |
| 24 | 7-Color Tail Back | `tail` |
| 25 | Red Tail | `tail` |
| 26 | Red Tail Back | `tail` |
| 27 | Green Tail | `tail` |
| 28 | Green Tail Back | `tail` |
| 29 | Blue Tail | `tail` |
| 30 | Blue Tail Back | `tail` |
| 31 | Yellow Tail | `tail` |
| 32 | Yellow Tail Back | `tail` |
| 33 | Cyan Tail | `tail` |
| 34 | Cyan Tail Back | `tail` |
| 35 | Purple Tail | `tail` |
| 36 | Purple Tail Back | `tail` |
| 37 | White Tail | `tail` |
| 38 | White Tail Back | `tail` |
| 39 | 7-Color Water | `water` |
| 40 | 7-Color Water Back | `water` |
| 41 | R-G-B Water | `water` |
| 42 | R-G-B Water Back | `water` |
| 43 | Y-C-P Water | `water` |
| 44 | Y-C-P Water Back | `water` |
| 45 | R-G Water | `water` |
| 46 | R-G Water Back | `water` |
| 47 | G-B Water | `water` |
| 48 | G-B Water Back | `water` |
| 49 | Y-B Water | `water` |
| 50 | Y-B Water Back | `water` |
| 51 | Y-C Water | `water` |
| 52 | Y-C Water Back | `water` |
| 53 | C-P Water | `water` |
| 54 | C-P Water Back | `water` |
| 55 | White Water | `water` |
| 56 | White Water Back | `water` |
| 57 | 7-Color Close | `curtain` |
| 58 | 7-Color Open | `curtain` |
| 59 | R-G-B Close | `curtain` |
| 60 | R-G-B Open | `curtain` |
| 61 | Y-C-P Close | `curtain` |
| 62 | Y-C-P Open | `curtain` |
| 63 | Red Close | `curtain` |
| 64 | Red Open | `curtain` |
| 65 | Green Close | `curtain` |
| 66 | Green Open | `curtain` |
| 67 | Blue Close | `curtain` |
| 68 | Blue Open | `curtain` |
| 69 | Yellow Close | `curtain` |
| 70 | Yellow Open | `curtain` |
| 71 | Cyan Close | `curtain` |
| 72 | Cyan Open | `curtain` |
| 73 | Purple Close | `curtain` |
| 74 | Purple Open | `curtain` |
| 75 | White Close | `curtain` |
| 76 | White Open | `curtain` |
| 77 | 7-Color Race | `basic` |
| 78 | 7-Color Race Back | `basic` |
| 79 | R-G-B Race | `basic` |
| 80 | R-G-B Race Back | `basic` |
| 81 | Y-C-P Race | `basic` |
| 82 | Y-C-P Race Back | `basic` |
| 83 | 7-Color Wave | `basic` |
| 84 | 7-Color Wave Back | `basic` |
| 85 | R-G-B Wave | `basic` |
| 86 | R-G-B Wave Back | `basic` |
| 87 | Y-C-P Wave | `basic` |
| 88 | Y-C-P Wave Back | `basic` |
| 89 | Red Running | `run` |
| 90 | Red Run Back | `runback` |
| 91 | Green Running | `run` |
| 92 | Green Run Back | `runback` |
| 93 | Blue Running | `run` |
| 94 | Blue Run Back | `runback` |
| 95 | Yellow Running | `run` |
| 96 | Yellow Run Back | `runback` |
| 97 | Cyan Running | `run` |
| 98 | Cyan Run Back | `runback` |
| 99 | Purple Running | `run` |
| 100 | Purple Run Back | `runback` |
| 101 | White Running | `run` |
| 102 | White Run Back | `runback` |
| 103 | 7-Color Running | `run` |
| 104 | 7-Color Run Back | `runback` |
| 105 | R-G-B Running | `run` |
| 106 | R-G-B Run Back | `runback` |
| 107 | Y-C-P Running | `run` |
| 108 | Y-C-P Run Back | `runback` |
| 109 | B-P-C-Y Running | `run` |
| 110 | B-P-C-Y Run Back | `runback` |
| 111 | B-G-C-Y Running | `run` |
| 112 | B-G-C-Y Run Back | `runback` |
| 113 | Red-Dot in White Running | `run` |
| 114 | Red-Dot in White Run Back | `runback` |
| 115 | Green-Dot in Red Running | `run` |
| 116 | Green-Dot in Red Run Back | `runback` |
| 117 | Blue-Dot in Green Running | `run` |
| 118 | Blue-Dot in Green Run Back | `runback` |
| 119 | Yellow-Dot in Blue Running | `run` |
| 120 | Yellow-Dot in Blue Run Back | `runback` |
| 121 | Cyan-Dot in Yellow Running | `run` |
| 122 | Cyan-Dot in Yellow Run Back | `runback` |
| 123 | Purple-Dot in Cyan Running | `run` |
| 124 | Purple-Dot in Cyan Run Back | `runback` |
| 125 | White-Dot in Purple Running | `run` |
| 126 | White-Dot in Purple Run Back | `runback` |
| 127 | White-Dot in Red Running | `run` |
| 128 | White-Dot in Red Run Back | `runback` |
| 129 | 7-Color in Red Running | `run` |
| 130 | 7-Color in Red Run Back | `runback` |
| 131 | 7-Color in Green Running | `run` |
| 132 | 7-Color in Green Run Back | `runback` |
| 133 | 7-Color in Blue Running | `run` |
| 134 | 7-Color in Blue Run Back | `runback` |
| 135 | 7-Color in Yellow Running | `run` |
| 136 | 7-Color in Yellow Run Back | `runback` |
| 137 | 7-Color in Cyan Running | `run` |
| 138 | 7-Color in Cyan Run Back | `runback` |
| 139 | 7-Color in Purple Running | `run` |
| 140 | 7-Color in Purple Run Back | `runback` |
| 141 | 7-Color in White Running | `run` |
| 142 | 7-Color in White Run Back | `runback` |
| 143 | W-R-W Flow | `flow` |
| 144 | W-R-W Flow Back | `flow` |
| 145 | W-G-W Flow | `flow` |
| 146 | W-G-W Flow Back | `flow` |
| 147 | W-B-W Flow | `flow` |
| 148 | W-B-W Flow Back | `flow` |
| 149 | W-Y-W Flow | `flow` |
| 150 | W-Y-W Flow Back | `flow` |
| 151 | W-C-W Flow | `flow` |
| 152 | W-C-W Flow Back | `flow` |
| 153 | W-P-W Flow | `flow` |
| 154 | W-P-W Flow Back | `flow` |
| 155 | R-W-R Flow | `flow` |
| 156 | R-W-R Flow Back | `flow` |
| 157 | G-W-G Flow | `flow` |
| 158 | G-W-G Flow Back | `flow` |
| 159 | B-W-B Flow | `flow` |
| 160 | B-W-B Flow Back | `flow` |
| 161 | Y-W-Y Flow | `flow` |
| 162 | Y-W-Y Flow Back | `flow` |
| 163 | C-W-C Flow | `flow` |
| 164 | C-W-C Flow Back | `flow` |
| 165 | P-W-P Flow | `flow` |
| 166 | P-W-P Flow Back | `flow` |
| 167 | Green-Dot in Blue Running | `run` |
| 168 | Green-Dot in Blue Run Back | `runback` |
| 169 | Green-Dot in Red Running | `run` |
| 170 | Green-Dot in Red Run Back | `runback` |
| 171 | Red-Dot in Blue Running | `run` |
| 172 | Red-Dot in Blue Run Back | `runback` |
| 173 | Cyan-Dot in Yellow Running | `run` |
| 174 | Cyan-Dot in Yellow Run Back | `runback` |
| 175 | Yellow-Dot in Purple Running | `run` |
| 176 | Yellow-Dot in Purple Run Back | `runback` |
| 177 | White-Dot in Yellow Running | `run` |
| 178 | Yellow-Dot in Purple Run Back | `runback` |
| 179 | Yellow-Dot in White Running | `run` |
| 180 | White-Dot in Yellow Run Back | `runback` |
| 181 | 7-Color Flush | `basic` |
| 182 | 7-Color Flush Back | `basic` |
| 183 | R-G-B Flush | `basic` |
| 184 | R-G-B Flush Back | `basic` |
| 185 | Y-C-P Flush | `basic` |
| 186 | Y-C-P Flush Back | `basic` |
| 187 | 7-Color Flush Close | `basic` |
| 188 | 7-Color Flush Open | `basic` |
| 189 | R-G-B Flush Close | `basic` |
| 190 | R-G-B Flush Open | `basic` |
| 191 | Y-C-P Flush Close | `basic` |
| 192 | Y-C-P Flush Open | `basic` |
| 193 | 7-Color Jump | `basic` |
| 194 | R-G-B Jump | `basic` |
| 195 | Y-C-P Jump | `basic` |
| 196 | 7-Color Strobe | `basic` |
| 197 | R-G-B Strobe | `basic` |
| 198 | Y-C-P Strobe | `basic` |
| 199 | 7-Color Gradual | `basic` |
| 200 | R-Y Gradual | `basic` |
| 201 | R-P Gradual | `basic` |
| 202 | G-C Gradual | `basic` |
| 203 | G-Y Gradual | `basic` |
| 204 | B-P Gradual | `basic` |
| 205 | Red Marquee | `basic` |
| 206 | Green Marquee | `basic` |
| 207 | Blue Marquee | `basic` |
| 208 | Yellow Marquee | `basic` |
| 209 | Cyan Marquee | `basic` |
| 210 | Purple Marquee | `basic` |
| 211 | White Marquee | `basic` |
| 212 | 7-Color Energy | `basic` |

## Use from Python

```python
from lotus_lamp import get_mode_by_category_index, search_modes

print(get_mode_by_category_index("flow", 1))  # 143
print(search_modes("cyan"))
```

Pass an ID to `await lamp.set_animation(mode_id)` on a connected library controller. See [configuration](../CONFIGURATION.md) and [examples](../examples/README.md).

## Preview direction and limits

Names containing Back move left in horizontal illustrations and down on the vertical lamp illustration; other variants move right/up. This is the requested UI coordinate convention, not a command to reverse firmware playback. Illustrations use generic color/family patterns and do not reproduce exact native frames. Pause is experimental and timed custom recall remains approximate; see [the app guide](../LOCAL_APP.md).
