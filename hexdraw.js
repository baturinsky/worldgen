"use strict";

/**
 * @returns {CanvasRenderingContext2D}
 */
function context2d(canvas) {
  return canvas.getContext("2d");
}

/**
 * @param {number} width
 * @param {number} height
 * @returns {{canvas:HTMLCanvasElement, ctx:CanvasRenderingContext2D}}
 */
function createCanvasCtx(width, height) {
  let canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  let ctx = context2d(canvas);
  return { canvas, ctx };
}

/**
 * Creates a 12-sector masks for cutting up hexes
 */
function createMask(size = 32) {
  let canvases = [...Array(13)].map(() => {
    let { canvas, ctx } = createCanvasCtx(size, size);
    let data = ctx.createImageData(size, size);
    return { canvas, data };
  });

  for (let x = 0; x < size; x++)
    for (let y = 0; y < size; y++) {
      let point = (y * size + x) * 4;
      let angle = Math.atan2(size / 2 - 0.5 - x, y - (size / 2 - 0.5));
      let sector = Math.floor((angle / Math.PI + 1) * 6);
      canvases[sector].data.data.set([255, 255, 255, 255], point);
      canvases[12].data.data.set(
        [
          (sector / 12) * 255,
          255 - (sector / 12) * 255,
          (sector % 2) * 255,
          255,
        ],
        point
      );
    }
  for (let c of canvases) {
    context2d(c.canvas).putImageData(c.data, 0, 0);
  }
  return canvases.map((c) => c.canvas);
}

function cutImageUp(image, left, top, masks) {
  let imagePieces = [];
  let size = masks[0].width;
  let r = size / 2;

  for (let part = 0; part < 3; part++) {
    for (let sector = 0; sector < 12; sector++) {
      let { canvas, ctx } = createCanvasCtx(r * 2, r * 2);

      ctx.drawImage(masks[sector], 0, 0);
      ctx.globalCompositeOperation = "source-in";

      ctx.drawImage(
        image,
        left,
        top + part * size,
        size,
        size,
        0,
        0,
        size,
        size
      );

      ctx.globalCompositeOperation = "source-over";

      imagePieces.push(canvas);
    }
  }

  return imagePieces;
}

function ind2xy(xy, columns) {
  let x = xy % columns;
  let y = (xy - x) / columns;
  return [x, y];
}

function screenPos(ind, columns, hexWidth, geometry, hexHeight = 0) {
  let [x, y] = ind2xy(ind, columns);
  return [
    (x + (geometry == 0 ? 0 : geometry == 1 ? (y % 2) * 0.5 : -y * 0.5)) *
      hexWidth,
    y * (hexHeight || hexWidth * 0.75),
  ];
}

function drawTile(ctx, tile, ind, columns, geometry, neighborDeltas, connect) {
  if (!neighborDeltas) {
    let [tileX, tileY] = screenPos(ind, columns, tile.width, geometry);
    ctx.drawImage(tile, tileX, tileY);
    return;
  }
  let [tileX, tileY] = screenPos(ind, columns, tile[0].width, geometry);
  let y = Math.floor(ind / columns);
  let deltas = neighborDeltas[y % 2];
  for (let subi = 0; subi < 12; subi++) {
    let imagei = subi;
    let side = Math.floor(subi / 2);
    let neighbor2Side = (side + (subi % 2 ? 1 : 5)) % 6;
    let neighbor1 = connect(ind + deltas[side], ind);
    let neighbor2 = connect(ind + deltas[neighbor2Side], ind);
    let mode = neighbor1 ? 2 : neighbor2 ? 1 : 0;
    imagei += mode * 12;
    ctx.drawImage(tile[imagei], tileX, tileY);
  }
}

function drawTerrain(ctx, grid, directional, columns, tileset, geometry) {
  let neighborDeltas = createNeighborDeltas(columns, geometry);
  let tileSize = tileset.tilesSize;
  let rows = grid.length / columns;

  let masks = createMask(tileSize);

  let sprites = [];
  let connected = [];
  for (let layer of tileset.connected) {
    let slices = cutImageUp(
      tileset.tilesheet,
      layer[1] * tileSize,
      layer[2] * tileSize,
      masks
    );
    sprites[layer[0]] = slices;
    connected[layer[0]] = true;
  }
  for (let tile of tileset.single) {
    let image = subImage(
      tileset.tilesheet,
      tile[1] * tileSize,
      tile[2] * tileSize,
      tileSize,
      tileSize
    );
    sprites[tile[0]] = image;
  }

  let idToGroup = sprites.map((v, i) => i);

  if (tileset.grouped)
    for (let grouped of tileset.grouped) {
      let group = grouped[0];
      for (let id of grouped) idToGroup[id] = group;
    }

  let bits = grid.map((list) => {
    let b = 0;
    for (let v of list) {
      if (connected[v]) b = b | 1 << idToGroup[v];
    }
    return b;
  });

  for (let ind = 0; ind < columns * rows; ind++) {
    if(grid[ind])
    for (let layer of grid[ind]) {
      if (connected[layer])
        drawTile(
          ctx,
          sprites[layer],
          ind,
          columns,
          geometry,
          neighborDeltas,
          (neighbor) => {
            if (!(bits[neighbor] & (1 << idToGroup[layer]))) return false;
            if (!(layer in directional)) return true;
            return (
              directional[layer][neighbor] == ind ||
              directional[layer][ind] == neighbor
            );
          }
        );
      else drawTile(ctx, sprites[layer], ind, columns, geometry);
    }
  }
}
