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
 * Creates a sectored masks for cutting up hexes (or squares)
 * @param {number} size - tile size in pixels
 * @param {number} layout
 */
function createMask(size = 32, layout) {
  let sectorsNumber = layout == SQUARE ? 8 : 12;

  let canvases = [...Array(sectorsNumber + 1)].map(() => {
    let { canvas, ctx } = createCanvasCtx(size, size);
    let data = ctx.createImageData(size, size);
    return { canvas, data };
  });

  for (let x = 0; x < size; x++)
    for (let y = 0; y < size; y++) {
      let point = (y * size + x) * 4;
      let angle = Math.atan2(size / 2 - 0.5 - x, y - (size / 2 - 0.5));
      let sector =
        sectorsNumber == 12
          ? Math.floor((angle / Math.PI + 1) * 6)
          : (Math.floor((angle / Math.PI + 1) * 4) + 1) % 8;
      canvases[sector].data.data.set([255, 255, 255, 255], point);
      canvases[sectorsNumber].data.data.set(
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

function cutImageToSectors(image, left, top, masks) {
  let imagePieces = [];
  let size = masks[0].width;
  let r = size / 2;

  for (let part = 0; part < 3; part++) {
    for (let sector = 0; sector < masks.length - 1; sector++) {
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

/**
 *
 * @param {*} image
 * @param {*} columns
 * @param {*} rows
 * @param {*} fragmentWidth
 * @param {*} fragmentHeight
 * @param {*} left
 * @param {*} top
 */
function cutImageUp(
  image,
  columns,
  rows,
  fragmentWidth,
  fragmentHeight,
  left = 0,
  top = 0
) {
  let imagePieces = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      let { canvas, ctx } = createCanvasCtx(fragmentWidth, fragmentHeight);
      ctx.drawImage(
        image,
        left + x * fragmentWidth,
        top + y * fragmentHeight,
        fragmentWidth,
        fragmentHeight,
        0,
        0,
        fragmentWidth,
        fragmentHeight
      );
      imagePieces.push(canvas);
    }
  }
  return imagePieces;
}

/**
 * For each tile quater, in order of left to right and up to down,
 * number represents in which case it should be drawn, depending on same tile neighbors
 * 0 - no neighbors
 * 1 - neighbor horizontally
 * 2 - vertically
 * 3 - horizontally and vertically
 * 4 - nor horizontally or vertically, but diagonally
 */
const partsOrder = "334433443223100110013223"
  .split("")
  .map((s, i) => Number(s) * 4 + (i % 2) + (Math.floor(i / 4) % 2) * 2);

function cutImagetoSquares(img, left, top) {
  let partsUnordered = cutImageUp(img, 4, 6, 16, 16, left, top);
  let tile = [];
  partsOrder.forEach((v, i) => (tile[v] = partsUnordered[i]));
  return tile;
}

const pathNeighbors = [
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

const pathDisplacement = -0.1

/**
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Tileset} tile - tileset
 * @param {number} pos - position of the tile
 * @param {number} columns - number of columns
 * @param {(pos:number) => boolean} connect
 */
function drawPath(ctx, tile, pos, columns, connect) {
  let tileWidth = tile[0].width;
  let [tileX, tileY] = screenPos(pos, columns, SQUARE, tileWidth);
  let pixelPathDisplacement = Math.floor(tileWidth * pathDisplacement)
  ctx.drawImage(tile[1], tileX + pixelPathDisplacement, tileY + pixelPathDisplacement);
  for (let i = 0; i < 4; i++) {
    let connected = connect(
      pos + pathNeighbors[i][0] + pathNeighbors[i][1] * columns
    );
    if (connected)
      ctx.drawImage(
        tile[2 + i],
        tileX + tileWidth * (pathNeighbors[i][0] / 2) + pixelPathDisplacement,
        tileY + tileWidth * (pathNeighbors[i][1] / 2) + pixelPathDisplacement
      );
  }
}

function drawSquareTile(ctx, tile, pos, columns, connect) {
  if (tile.length == 6) return drawPath(ctx, tile, pos, columns, connect);

  let [tileX, tileY] = screenPos(pos, columns, SQUARE, tile[0].width * 2);
  for (let corner = 0; corner < 4; corner++) {
    let dx = corner % 2 ? 1 : -1;
    let dy = corner > 1 ? 1 : -1;
    let xNear = !connect(pos + dx);
    let yNear = !connect(pos + dy * columns);
    let kind = 0;
    if (xNear || yNear) {
      kind = xNear + yNear * 2;
    } else if (!connect(pos + dy * columns + dx)) {
      kind = 4;
    }
    ctx.drawImage(
      tile[kind * 4 + corner],
      tileX + (corner % 2 ? 16 : 0),
      tileY + (corner > 1 ? 16 : 0)
    );
  }
}

/**
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {*} tile
 * @param {number} pos
 * @param {number} layout
 * @param {number} columns
 * @param {number[][]} neighborDeltas
 * @param {(pos:number) => boolean} connect
 */
function drawTile(ctx, tile, pos, layout, columns, neighborDeltas, connect) {
  if (!tile) return;

  if (!neighborDeltas) {
    let [tileX, tileY] = screenPos(pos, columns, layout, tile.width);
    ctx.drawImage(tile, tileX, tileY);
    return;
  }

  if (layout == SQUARE) return drawSquareTile(ctx, tile, pos, columns, connect);

  let [tileX, tileY] = screenPos(pos, columns, layout, tile[0].width);
  let row = Math.floor(pos / columns);
  let deltas = neighborDeltas[row % 2];
  let sectorsNumber = layout == SQUARE ? 8 : 12;

  for (let subi = 0; subi < sectorsNumber; subi++) {
    let imagei = subi;
    let side = Math.floor(subi / 2);
    let neighbor2Side =
      (side + (subi % 2 ? 1 : sectorsNumber / 2 - 1)) % (sectorsNumber / 2);
    let neighbor1 = connect(pos + deltas[side]);
    let neighbor2 = connect(pos + deltas[neighbor2Side]);
    let mode = neighbor1 ? 2 : neighbor2 ? 1 : 0;
    imagei += mode * sectorsNumber;
    ctx.drawImage(tile[imagei], tileX, tileY);
  }
}

const ISPATH = 1;

function createSprites(tileset, layout) {
  let tileSize = tileset.tilesSize;

  let masks = createMask(tileSize, layout);

  let sprites = [];
  for (let layer of tileset.connected) {
    let ispath = layer[3] & ISPATH ? true : false;
    let slices =
      layout == SQUARE
        ? ispath
          ? cutImageUp(
              tileset.tilesheet,
              2,
              3,
              32,
              32,
              layer[1] * tileSize,
              layer[2] * tileSize
            )
          : cutImagetoSquares(
              tileset.tilesheet,
              layer[1] * tileSize,
              layer[2] * tileSize
            )
        : cutImageToSectors(
            tileset.tilesheet,
            layer[1] * tileSize,
            layer[2] * tileSize,
            masks
          );
    sprites[layer[0]] = slices;
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
  return sprites;
}

/**
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[][]} grid - lists of sprite indices
 * @param {{[key:number]:number[]}} directional - for directional tiles (such as RIVER for hex map) - list of cell it flows to
 * @param {number} columns - number of columns
 * @param {Tileset} tileset
 * @param {number} layout
 */
function drawTerrain(ctx, grid, directional, columns, tileset, layout) {
  let neighborDeltas = createNeighborDeltas(columns, layout);
  let rows = grid.length / columns;

  let sprites = createSprites(tileset, layout);

  let connected = [];
  for (let layer of tileset.connected) connected[layer[0]] = true;

  let idToGroup = sprites.map((_, i) => i);
  if (tileset.grouped)
    for (let grouped of tileset.grouped) {
      let group = grouped[0];
      for (let id of grouped) idToGroup[id] = group;
    }

  /**
   * Bitmap of connectable sprite ids
   * So, don't have their ids bigger than 32
   */

  let bits = new Uint32Array(grid.length);
  for (let i in grid) {
    let list = grid[i];
    let b = 0;
    for (let v of list) {
      if (connected[v]) b = b | (1 << idToGroup[v]);
    }
    bits[i] = b;
  }

  for (let ind = 0; ind < columns * rows; ind++) {
    if (grid[ind])
      for (let layer of grid[ind]) {
        if (connected[layer]) {
          drawTile(
            ctx,
            sprites[layer],
            ind,
            layout,
            columns,
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
        } else {
          drawTile(ctx, sprites[layer], ind, layout, columns);
        }
      }
  }
}
