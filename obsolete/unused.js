/**
 * @param {CanvasRenderingContext2D} ctx
 */
function shiftingCircles(ctx) {
  ctx.save();
  let width = ctx.canvas.width;
  let height = ctx.canvas.height;

  ctx.fillStyle = `rgba(128, 128, 128, 1)`;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 1000; i++) {
    let points = [...Array(6)].map(() => random());

    let [x, y] = [points[0] * width, points[1] * height];
    let r = Math.pow(points[2], 2) * 100 + 50;

    let style = `rgba(${points[3] * 255}, ${points[4] * 255}, ${
      points[5] * 255
    }, 0.1)`;

    let g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(
      0,
      `rgba(${points[3] * 255}, ${points[4] * 255}, ${points[5] * 255}, 0.5)`
    );

    g.addColorStop(
      1,
      `rgba(${points[3] * 255}, ${points[4] * 255}, ${points[5] * 255}, 0)`
    );

    ctx.fillStyle = g;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function erode(){
  erosion = Math.pow(erosion, 2);
    
  elevation = elevation.map((v, i) =>
    v > 0 ? (v * (1 + folds[i] * erosion)) / (1 + erosion) : v
  );
}

const chartColors = mapToList({
  [DESERT]: "C87137",
  [GRASSLAND]: "927E30",
  [TUNDRA]: "93A7AC",
  [SAVANNA]: "97A527",
  [SHRUBLAND]: "B37C06",
  [TAIGA]: "5B8F52",
  [DENSE_FOREST]: "2C89A0",
  [TEMPERATE_FOREST]: "0A546D",
  [RAIN_FOREST]: "075330",
  [SWAMP]: "2f6666",
  [SNOW]: "ffffff",
  [STEPPE]: "a0ffa0",
}).map(colorFromRGBString);

const redblobColors = mapToList({
  [DESERT]: "a09077",
  [GRASSLAND]: "88aa55",
  [TUNDRA]: "ffffff",
  [SAVANNA]: "c9d29b",
  [SHRUBLAND]: "889977",
  [TAIGA]: "99aa77",
  [DENSE_FOREST]: "559944",
  [TEMPERATE_FOREST]: "679459",
  [RAIN_FOREST]: "337755",
  [SWAMP]: "2f6666",
  [SNOW]: "ffffff",
  [STEPPE]: "808080",
}).map(colorFromRGBString);