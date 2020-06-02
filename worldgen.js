"use strict";

let randomSeed = 6;

function random() {
  let x = Math.sin(randomSeed) * 10000;
  randomSeed = (randomSeed + Math.E) % 1e8;
  return x - Math.floor(x);
}

/**
 * @param {number} x
 * @param {number} y
 */
function coord2ind([x, y], width) {
  return [Math.floor(x) + Math.floor(y * width)];
}

/**
 * @param {number} width
 * @param {number} height
 * @returns {{canvas:HTMLCanvasElement, ctx:CanvasRenderingContext2D}}
 */

function createCanvasCtx(width, height) {
  /** @type {HTMLCanvasElement} */
  let canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  /** @type {CanvasRenderingContext2D} */
  let ctx = canvas.getContext("2d");
  return { canvas, ctx };
}

/**
 * @returns {CanvasRenderingContext2D}
 */
function context2d(canvas) {
  return canvas.getContext("2d");
}

/**
 * @param {HTMLCanvasElement} ctx
 * @returns {{values:Float32Array[], width:number, height:number}}
 */
function image2alpha(canvas) {
  let ctx = context2d(canvas);
  let idata = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let data = idata.data;
  let values = new Float32Array(data.length / 4);
  for (let i = 0; i < data.length; i++) values[i] = data[i * 4 + 3] / 255;

  return values;
}

/**
 * Gradient noise generated by throwing ellipses at the plain
 * @param {number} width
 * @param {number} height
 */
function gradientNoise(
  width,
  height,
  points = 5000,
  radius = 100,
  alpha = 0.01,
  gradientCircles = true
) {
  let { canvas, ctx } = createCanvasCtx(width, height);

  if (gradientCircles) {
    let g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    g.addColorStop(1, `rgba(255, 255, 255, 0)`);

    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  }

  for (let i = 0; i < points; i++) {
    let points = [...Array(3)].map(() => random());

    let [x, y] = [points[0] * width, points[1] * height];
    let r = Math.pow(points[2], 2) * radius;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(random() * Math.PI);
    ctx.scale(r * (0.5 + random()), r * (0.5 + random()));
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return canvas;
}

function addFilter(srcCanvas, filter) {
  let { canvas, ctx } = createCanvasCtx(srcCanvas.width, srcCanvas.height);
  ctx.filter = filter;
  ctx.drawImage(srcCanvas, 0, 0);
  return canvas;
}

/**
 * Monte-Carlo approximation of the median
 * @param {number[]} values
 * @param {number} picks
 * @param {number} level
 */
function approximateMedian(values, level = 0.5, picks = 1000) {
  let l = values.length;
  let picked = [...Array(picks)].map(() => values[Math.floor(random() * l)]);
  picked = picked.sort();
  return picked[Math.floor(level * picked.length)];
}

function normalizeValues(values, picks = 1000) {
  let l = values.length;
  let picked = [...Array(picks)].map(() => values[Math.floor(random() * l)]);
  let max = 0;
  for (let v of picked) if (v > max) max = v;
  return values.map((v) => v / max);
}

/**
 * @param {number} width
 * @param {number} height
 */
function generateMap({
  width,
  height,
  seed,
  seaRatio,
  erosion,
  pangaea,
  riverAge,
  riversShown,
  randomiseHumidity = true,
}) {
  randomSeed = seed;

  const mapSize = width * height;
  const mapDiagonal = Math.sqrt(width * width + height * height);

  console.time("noise");

  let noise = image2alpha(
    addFilter(
      gradientNoise(width, height, 3000, mapDiagonal * 0.15, 0.01),
      "blur(2px)"
    )
  );
  let tectonic = image2alpha(
    addFilter(
      gradientNoise(width, height, 2000, mapDiagonal * 0.15, 0.03),
      "blur(5px)"
    )
  );
  console.timeEnd("noise");

  console.time("main");

  let tectonicMedian = approximateMedian(tectonic, 0.5);

  let folds = tectonic.map(
    (v) => 1 / (1 + 5 * Math.atan(Math.abs(tectonicMedian - v)))
  );

  let elevation = noise.map(
    (_, i) =>
      5 +
      noise[i] * 10 +
      tectonic[i] * 5 +
      3 * folds[i] +
      -pangaea *
        (Math.abs(i / mapSize - 0.5) + Math.abs((i % width) / width - 0.5))
  );
  console.timeEnd("main");

  console.time("normalize");

  elevation = normalizeValues(elevation);
  
  let highest = approximateMedian(elevation, 0.99);
  let seaLevel = approximateMedian(elevation, seaRatio);

  elevation = elevation.map((v) =>
    v < seaLevel
      ? -Math.pow(1 - v / seaLevel, 0.4)
      : (v - seaLevel) / (1 - seaLevel) / highest
  );

  console.timeEnd("normalize");

  let temperature = elevation.map(
    (v, i) => 50 - 110 * Math.abs(0.5 - i / mapSize) - Math.max(0, v) * 30
  );

  let wind = elevation.map(
    (v, i) =>
      Math.cos((Math.abs(0.5 - i / mapSize) * 4 + 0.75) * Math.PI) /
      (1 + 2 * Math.max(0, elevation[i]))
  );

  console.time("windSmoothing");
  wind = image2alpha(
    addFilter(
      data2image(wind, width, (v) => [0, 0, 0, 127 * (v + 1)]),
      "blur(5px)"
    )
  ).map((v) => v * 2 - 1);
  console.timeEnd("windSmoothing");

  let humidity = generateHumidity({ width, height, elevation, wind });

  if (randomiseHumidity) {
    humidity = humidity.map((v, i) =>
      Math.max(0, v + Math.sin(noise[i] * 50) / 10 - elevation[i] * 0.2)
    );
  }

  let rivers = generateRivers({
    width,
    height,
    elevation,
    humidity,
    riverAge,
    riversShown,
  });

  let biome = temperature.map(
    (t, i) =>
      biomeTable[Math.floor(Math.max(0, Math.min(humidity[i] * 4.5, 5)))][
        Math.floor(Math.max(0, Math.min(t / 10 + 1, 3)))
      ] || 0
  );

  return {
    elevation,
    folds,
    rivers,
    wind,
    noise,
    tectonic,
    temperature,
    humidity,
    biome,
  };
}

function generateHumidity({ width, height, elevation, wind }) {
  console.time("humidity");
  const mapDiagonal = Math.sqrt(width * width + height * height);

  let border = width / 2;

  let humidityImage = data2image(elevation, width, (v, i) => [
    0,
    0,
    0,
    v <= 0 ? 255 : 0,
  ]);
  let wetness = createCanvasCtx(width + border * 2, height + border * 2);

  wetness.ctx.beginPath();
  wetness.ctx.rect(border / 2, border / 2, width + border, height + border);
  wetness.ctx.lineWidth = border / 2;
  wetness.ctx.stroke();

  wetness.ctx.drawImage(humidityImage, width / 2, height / 2);

  wetness.ctx.filter = "opacity(15%)";
  const spotSize = mapDiagonal / 10;
  for (let i = 0; i < 1000; i++) {
    let end = [random() * width, random() * height];
    let endWind = wind[coord2ind(end, width)];
    let start = [
      end[0] + (endWind * (random() - 0.2) * width) / 4,
      end[1] + (Math.abs(endWind) * (random() - 0.5) * width) / 16,
    ];
    wetness.ctx.drawImage(
      wetness.canvas,
      end[0] + border,
      end[1] + border,
      spotSize,
      spotSize,
      start[0] + border,
      start[1] + border,
      spotSize,
      spotSize
    );
  }

  context2d(humidityImage).filter = "blur(30px)";
  context2d(humidityImage).drawImage(
    wetness.canvas,
    border,
    border,
    width,
    height,
    0,
    0,
    width,
    height
  );

  let humidity = image2alpha(humidityImage);

  console.timeEnd("humidity");

  return humidity;
}

function generateRivers({
  width,
  height,
  elevation,
  humidity,
  riverAge,
  riversShown,
}) {
  console.time("rivers");

  let rivers = new Float32Array(width * height);

  let neighbors = [
    -1,
    1,
    -width,
    width,
    -1 - width,
    1 + width,
    1 - width,
    -1 + width,
  ];

  for (
    let streamIndex = 0;
    streamIndex < riverAge + riversShown;
    streamIndex++
  ) {
    let current = Math.floor(random() * width * height);
    if (humidity[current] < random()) continue;

    let limit = 10000;

    while (elevation[current] > -0.2 && limit-- > 0) {
      if (streamIndex > riverAge) {
        rivers[current] += 1;
      }
      let currentValue = elevation[current];

      let lowestNeighbor = 0,
        lowestValue = 100;

      for (let neighborIndex = 0; neighborIndex < 8; neighborIndex++) {
        let neighborDelta = neighbors[neighborIndex];
        let value = elevation[current + neighborDelta];
        if (value <= lowestValue) {
          lowestNeighbor = current + neighborDelta;
          lowestValue = elevation[lowestNeighbor];
        }
      }

      if (lowestValue < currentValue) {
        elevation[current] -= (currentValue - lowestValue) / 10;
        if (rivers[lowestNeighbor]) limit -= 10;
        current = lowestNeighbor;
      } else {
        elevation[current] = lowestValue + 0.02;
      }
    }
  }

  console.timeEnd("rivers");

  return rivers;
}

const DESERT = 1,
  GRASSLAND = 2,
  TUNDRA = 3,
  SAVANNA = 4,
  SHRUBLAND = 5,
  TAIGA = 6,
  DENSE_FOREST = 7,
  TEMPERATE_FOREST = 8,
  RAIN_FOREST = 9,
  SWAMP = 10,
  SNOW = 11,
  BARE = 12;

// -> temperature V humidity
const biomeTable = [
  [BARE, SAVANNA, SAVANNA, DESERT],
  [TUNDRA, SAVANNA, GRASSLAND, GRASSLAND],
  [TUNDRA, SHRUBLAND, GRASSLAND, TEMPERATE_FOREST],
  [SNOW, SHRUBLAND, TEMPERATE_FOREST, TEMPERATE_FOREST],
  [SNOW, TAIGA, DENSE_FOREST, DENSE_FOREST],
  [SNOW, TAIGA, RAIN_FOREST, RAIN_FOREST],
];

const biomeNames = [
  "unknown",
  "desert",
  "grassland",
  "tundra",
  "savanna",
  "shrubland",
  "taiga",
  "tropical forest",
  "decidious forest",
  "rain forest",
  "swamp",
  "snow",
  "bare",
];

function mapToList(m) {
  let l = [];
  for (let k in m) {
    l[k] = m[k];
  }
  return l;
}

function colorFromRGBString(color) {
  let n = parseInt(color, 16);
  return [Math.floor(n / 65536), Math.floor(n / 256) % 256, n % 256, 256];
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
  [BARE]: "808080",
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
  [BARE]: "808080",
}).map(colorFromRGBString);

const contrastColors = mapToList({
  [DESERT]: "ffff00",
  [GRASSLAND]: "40ff40",
  [TUNDRA]: "c0c0a0",
  [SAVANNA]: "c0c000",
  [SHRUBLAND]: "80c040",
  [TAIGA]: "008080",
  [DENSE_FOREST]: "008000",
  [TEMPERATE_FOREST]: "40a040",
  [RAIN_FOREST]: "00c080",
  [SWAMP]: "808000",
  [SNOW]: "ffffff",
  [BARE]: "808080",
}).map(colorFromRGBString);

/**
 * @param {number[]} values
 * @param {number} width
 * @param {number} height
 * @param {(v:number, i:number) => [number,number,number,number]} fun
 * @returns {HTMLCanvasElement}
 */

function data2image(values, width, fun) {
  let height = values.length / width;
  let { canvas, ctx } = createCanvasCtx(width, height);
  let idata = ctx.createImageData(width, height);
  for (let i = 0; i < values.length; i++) {
    idata.data.set(fun(values[i], i), i * 4);
  }
  ctx.putImageData(idata, 0, 0);
  return canvas;
}

/**
 * @param {number[]} elevation
 */
function elevation2Image(
  { elevation, rivers },
  {
    discreteHeights = 10,
    terrainTypeColoring = false,
    hillRatio = 0.1,
    mountainRatio = 0.02,
  }
) {
  let hillElevation = approximateMedian(elevation, 1 - hillRatio);
  let mountainElevation = approximateMedian(elevation, 1 - mountainRatio);

  console.log("hill", hillElevation);
  console.log("mountain", mountainElevation);

  let green = true;

  return (v, i) => {
    if (rivers[i] && v > 0) {
      return [0, v * 400, 200, 255];
    }

    let level = discreteHeights
      ? Math.floor(v * discreteHeights) / discreteHeights
      : v;

    if (v > 0) {
      if (terrainTypeColoring)
        return v < hillElevation
          ? [32, 128, 32, 255]
          : v < mountainElevation
          ? [196, 196, 32, 255]
          : [128, 32, 0, 255];
      else
        return green
          ? [level * 300, level * 200 + 100, 50, 255]
          : [250 - level * 300, 200 - level * 300, 0, 255];
    } else {
      return [0, level * 60 + 60, level * 80 + 100, 255];
    }
  };
}

function heightMap2HexGrid({ values, width }, scale = 16) {
  let result = [];

  for (let i = 0; i < values.length; i++) {
    let canvasX = i % width;
    let canvasY = Math.floor(i / width);

    let gridY = Math.floor(canvasY / (scale * 0.75));
    let gridX = Math.floor(canvasX / scale + gridY / 2);

    let alpha = values[i];
    result[gridY * gridWidth + gridX] = alpha;
  }

  return result;
}

function rescaleImage(source, width, height) {
  let { canvas, ctx } = createCanvasCtx(width, height);
  ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, width, height);
  return canvas;
}