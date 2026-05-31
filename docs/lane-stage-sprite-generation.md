# Lane and Stage Sprite Generation Specification

This document records the lane/stage sprite generation behavior from
`NonSpicyBurrito/sonolus-bandori-skin-generator` main commit
`8ada79fb9f336b23cc54af4dcc385650db6b0187`.

The local generator should follow this contract so generated Bandori skin packs
contain the standard Sonolus lane/stage sprites required by engines and preview
engines.

## Goal

Generated skin packs must include both:

- Bandori custom field sprites, kept for engine-specific rendering:
  - `bandori:bg_line_rhythm`
  - `bandori:game_play_line`
  - `bandori:game_play_line_skill_adjust_effect`
- Standard Sonolus sprites derived from the same field assets:
  - `SkinSpriteName.StageMiddle`
  - `SkinSpriteName.StageLeftBorder`
  - `SkinSpriteName.StageLeftBorderSeamless`
  - `SkinSpriteName.StageRightBorder`
  - `SkinSpriteName.StageRightBorderSeamless`
  - `SkinSpriteName.StageTopBorder`
  - `SkinSpriteName.StageTopBorderSeamless`
  - `SkinSpriteName.StageBottomBorder`
  - `SkinSpriteName.StageBottomBorderSeamless`
  - `SkinSpriteName.StageTopLeftCorner`
  - `SkinSpriteName.StageTopRightCorner`
  - `SkinSpriteName.StageBottomLeftCorner`
  - `SkinSpriteName.StageBottomRightCorner`
  - `SkinSpriteName.Lane`
  - `SkinSpriteName.LaneSeamless`
  - `SkinSpriteName.LaneAlternative`
  - `SkinSpriteName.LaneAlternativeSeamless`
  - `SkinSpriteName.JudgmentLine`
  - `SkinSpriteName.NoteSlot`

The standard sprites are real atlas entries. They must be packed into
`texture.png` and referenced from compressed `data`; they are not generated at
runtime.

## Inputs

Fetch these fieldskin assets for the selected field skin ID and server:

- `bg_line_rhythm.png`: source for stage middle, lanes, borders, and corners.
- `game_play_line.png`: source for judgment line and note slot.
- `game_play_line_skill_adjust_effect.png`: keep as custom Bandori field sprite.

In the local project these inputs already exist in `getFieldResources()` as:

- `stageImage`
- `lineImage`
- `skillAdjustEffect`

## Derived Resources

Extend `FieldResources` with these derived `ImageAsset` values:

- `lane`
- `laneAlternative`
- `middle`
- `borderLeft`
- `borderRight`
- `borderTop`
- `borderBottom`
- `cornerTopLeft`
- `cornerTopRight`
- `cornerBottomLeft`
- `cornerBottomRight`
- `line`
- `slot`

## Algorithm

### 1. Estimate stage top perspective ratio

Find `topRatio` by minimizing `getTopRatioFitness(stageImage, x)` over:

- minimum: `0.01`
- maximum: `0.025`
- interval: `0.0001`

The fitness function flattens each row by interpolating pixels toward the
horizontal center:

```ts
const center = (width - 1) / 2
const ratio = topRatio + (y / (height - 1)) * (1 - topRatio)
const nx = (x - center) * ratio + center
```

For every destination `x` and channel, accumulate interpolated source values
from all rows. Return the sum of per-column variance (`m2` in the remote
implementation). The minimizing ratio is the best perspective flattening ratio.

Implementation note: if the local project does not already have an aggregate
variance helper, keep a tiny local accumulator with `count`, `mean`, and `m2`.

### 2. Flatten the stage top into one horizontal scanline

Build `flattened = stretchTop(stageImage, topRatio)`.

`stretchTop()` uses the same row interpolation formula above and returns a
single-row image:

- width: `stageImage.width`
- height: `1`
- channels: `4`
- each pixel/channel is the rounded average across all source rows after
  perspective correction.

### 3. Estimate lane width ratio

Find `laneRatio` by minimizing `getLaneRatioFitness(flattened, x)` over:

- minimum: `0.13`
- maximum: `0.135`
- interval: `0.0001`

The fitness compares the flattened scanline against itself shifted by
`width * laneRatio * 2`:

```ts
const offset = width * laneRatio * 2
const nx = x - offset
```

Ignore `x < width * 0.1`, `x > width * 0.9`, and shifted samples outside the
image. Sum absolute per-channel differences between `image.get(x, 0, c)` and
`image.interpolateX(nx, 0, c)`. The minimizing ratio is the lane width.

### 4. Generate lane sprites

Use `merge(image, centers, size)` to average horizontal slices from the
flattened scanline.

`merge()` returns a one-row image:

- width: `ceil(image.width * size)`
- height: `1`
- each output pixel samples every center at:

```ts
const offset = (center - size / 2) * (width - 1)
const nx = (x / (nWidth - 1)) * (width * size) + offset
```

Average all sampled centers per channel.

Then mirror-average the generated row horizontally:

```ts
output[x] = round((image[x] + image[width - 1 - x]) / 2)
```

Generate:

- `lane = mirrorAverageHeight(merge(flattened, [0.5 - laneRatio * 2, 0.5, 0.5 + laneRatio * 2], laneRatio))`
- `laneAlternative = mirrorAverageHeight(merge(flattened, [0.5 - laneRatio * 3, 0.5 - laneRatio, 0.5 + laneRatio, 0.5 + laneRatio * 3], laneRatio))`

### 5. Generate stage middle

Generate `middle = middleAverage(lane)`.

`middleAverage()` averages the center 80% of the one-row lane image:

- skip pixels where `x / (width - 1) < 0.1`
- skip pixels where `x / (width - 1) > 0.9`
- output is a `1x1` image.

### 6. Generate borders

Compute:

```ts
const borderRatio = 0.5 - laneRatio * 3.5
```

Generate:

- `borderLeft = merge(mirrorAverageHeight(flattened), [borderRatio / 2], borderRatio)`
- `borderRight = rotate(borderLeft, 180)`
- `borderTop = rotate(borderLeft, 90)`
- `borderBottom = rotate(borderLeft, -90)`

`borderLeft` is a one-row image. Rotated variants become the corresponding
vertical or reversed borders.

### 7. Generate corners

Generate `cornerTopLeft = cornerize(borderLeft)`.

`cornerize()` creates a square image:

- width: `borderLeft.width`
- height: `borderLeft.width`
- pixel `(x, y)` samples `borderLeft[min(x, y), 0]`

Generate rotated corners:

- `cornerTopRight = rotate(cornerTopLeft, 90)`
- `cornerBottomLeft = rotate(cornerTopLeft, -90)`
- `cornerBottomRight = rotate(cornerTopLeft, 180)`

### 8. Generate judgment line and note slot

Generate `line = flattenWidth(lineImage)`.

`flattenWidth()` averages `game_play_line.png` across all x positions and
returns a vertical image:

- width: `1`
- height: `lineImage.height`

Generate:

- `slot = circularize(mirrorAverageWidth(line))`

`mirrorAverageWidth()` averages top/bottom pixels of the vertical line:

```ts
output[y] = round((image[y] + image[height - 1 - y]) / 2)
```

`circularize()` creates a square image with side length `line.height`; each
pixel samples upward along the center line by radial distance:

```ts
const center = (height - 1) / 2
const radius = sqrt((x - center) ** 2 + (y - center) ** 2)
const ny = max(0, center - radius)
output[x, y] = image.interpolateY(0, ny, c)
```

## Sprite Registration

`buildFieldSprites()` should include the following additional sprite assets.
Use `scale(1, 1)` for all entries except `JudgmentLine`.

```ts
{
    names: [SkinSpriteName.StageMiddle],
    image: resources.middle,
    transform: scale(1, 1),
}
{
    names: [SkinSpriteName.StageLeftBorder, SkinSpriteName.StageLeftBorderSeamless],
    image: resources.borderLeft,
    transform: scale(1, 1),
}
{
    names: [SkinSpriteName.StageRightBorder, SkinSpriteName.StageRightBorderSeamless],
    image: resources.borderRight,
    transform: scale(1, 1),
}
{
    names: [SkinSpriteName.StageTopBorder, SkinSpriteName.StageTopBorderSeamless],
    image: resources.borderTop,
    transform: scale(1, 1),
}
{
    names: [SkinSpriteName.StageBottomBorder, SkinSpriteName.StageBottomBorderSeamless],
    image: resources.borderBottom,
    transform: scale(1, 1),
}
{
    names: [SkinSpriteName.StageTopLeftCorner],
    image: resources.cornerTopLeft,
    transform: scale(1, 1),
}
{
    names: [SkinSpriteName.StageTopRightCorner],
    image: resources.cornerTopRight,
    transform: scale(1, 1),
}
{
    names: [SkinSpriteName.StageBottomLeftCorner],
    image: resources.cornerBottomLeft,
    transform: scale(1, 1),
}
{
    names: [SkinSpriteName.StageBottomRightCorner],
    image: resources.cornerBottomRight,
    transform: scale(1, 1),
}
{
    names: [SkinSpriteName.Lane, SkinSpriteName.LaneSeamless],
    image: resources.lane,
    transform: scale(1, 1),
}
{
    names: [SkinSpriteName.LaneAlternative, SkinSpriteName.LaneAlternativeSeamless],
    image: resources.laneAlternative,
    transform: scale(1, 1),
}
{
    names: [SkinSpriteName.JudgmentLine],
    image: resources.line,
    transform: scale(1, 0.5),
}
{
    names: [SkinSpriteName.NoteSlot],
    image: resources.slot,
    transform: scale(1, 1),
}
```

Keep existing custom field sprites:

```ts
{
    names: [customName.field('bg_line_rhythm')],
    image: resources.stageImage,
    transform: scale(1, 1),
}
{
    names: [customName.field('game_play_line')],
    image: resources.lineImage,
    transform: scale(1, resources.lineImage.height / resources.lineImage.width / (90 / 1800)),
}
{
    names: [customName.field('game_play_line_skill_adjust_effect')],
    image: resources.skillAdjustEffect,
    transform: scale(1, 1),
}
```

## Atlas Requirements

All generated standard sprites must enter the normal sprite list before:

- `assertUniqueNames(sprites)`
- `packSprites(sprites)`
- `buildSkinData(width, height, packed)`
- `buildTexture(width, height, packed)`

The existing local atlas code already writes real texture pixels and one-pixel
padding for every packed sprite. No special texture path is required as long as
the generated images are included in `buildFieldSprites()`.

## Validation Checklist

After implementation:

1. Run `npm run typecheck`.
2. Run at least one sample generation.
3. Inspect generated compressed `data` or use the existing verifier to confirm
   the standard names are present:
   - `#LANE`
   - `#LANE_ALTERNATIVE`
   - `#STAGE_LEFT_BORDER`
   - `#STAGE_RIGHT_BORDER`
   - `#JUDGMENT_LINE`
4. Confirm the generated `texture.png` contains atlas entries for those names.
5. Use the generated skin with the NotGarupa preview engine; preview lanes
   should render without depending on `bandori:bg_line_rhythm` fallback logic.

## Implementation Notes for This Repository

- Put the derivation helpers near `src/resources/field.ts`, or split them into a
  dedicated `src/resources/lane.ts` if the file becomes too large.
- Reuse existing `ImageAsset` helpers from `src/image.ts`:
  - `createImage`
  - `getPixel`
  - `setPixel`
  - `interpolateX`
  - `interpolateY`
  - `rotate`
- Keep generated standard sprites grouped as field sprites in atlas sorting.
  If necessary, update `isFieldName()` / `fieldPackingOrder()` in `src/atlas.ts`
  so standard stage/lane names stay near the custom field entries.
- Do not remove custom `bandori:*` field sprites; some engine paths may still
  reference them directly.
