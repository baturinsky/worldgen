# Voronoi-less Terrain Generator
Fairly fast, fairly simple and fairly realistic terrain generator.

![Screenshot](/screenshots/index.png)

![Screenshot](/screenshots/ThreeMaps.png)

I tried to make a terrain generator that is simpler and easier to understand, yet sufficiently good.

I don't use Voronoi or any other polygonal partition - it's a simple 2d grid.
That lets me use canvas drawing for accelerating certain taxing simulation step.

So, it works as follows.

# It starts with a gradient noise

First step is a 2d gradient noise. Ususally Perlin or Simplex noise is used, but I used a simple algorithm: thrown many random semi-transparent circles
on canvas and using their sum. Btw, it allows writing a simple terrain generation in just few lines:

![Basic Gradient Nois Terrain Generation](/screenshots/BasicGradient.jpg)

what I use is just a bit more complex: instead of circles, I use ellipses that have opacity gradually reduce from center to edges.

# Tectonics 

![Tectonics](/screenshots/TectonicsSimulation.jpg)

I generate two 2d noises this way, dubbed "noise" and "crust". They can be smoothed a bit with "noiseSmoothness" and "tectonicSmoothness" sliders.

"Noise" is the fluctiation of the altitude within the tectonic plates, while "crust" emulates division of the crust into those plates.
Roughly speaking, high "crust" value represents continental plates, low means oceanic plates, and the value around the median is a tectonically active area between plates, that forms mountains etc.

Tectonic activity is measured by "tectonic" value, which is counted like this:

    let tectonic = crust.map(
      (v) => 0.2 / (Math.abs(tectonicMedian - v)+0.1) - 0.95 
    );

"Noise", "crust" and "tectonic" are summed together with some weights (that are set by noiseFactor, crustFactgor and tectonicFactor slider). Bigger weight for "crust" makes mountain ranges appear at the edge of landmasses, instead of in the middle of them. Bigger weight for "tectonic" makes more mountain ranges and island chains. Also "pangaea"-based value can be added that either raises (when "pangaea" > 0) or lowes the land near the middle.

    let elevation = noise.map(
      (_, i) =>
        5 +
        noise[i] * noiseFactor +
        crust[i] * crustFactor +
        tectonic[i] * tectonicFactor +
        -pangaea *
          (Math.abs(i / mapSize - 0.5) + Math.abs((i % width) / width - 0.5))
    );

# Normalising

Resulting value is ajusted dependent on desired sea percentage and dry land "flatness". Result is a value between -1 and 1, with sea level being at 0.
Higher "flatness" makes part of the land not on tectonic seams lower and flatter.

    elevation = normalizeValues(elevation);

    let seaLevel = approximateQuantile(elevation, seaRatio);

    elevation = elevation.map((v, i) =>
      v < seaLevel
        ? -Math.pow(1 - v / seaLevel, 0.4)
        : Math.pow(
            ((v - seaLevel) * (0.5 + tectonic[i] * 0.5)) / (1 - seaLevel),
            1 + 2 * flatness
          )
    );

# Erosion

![Sedimentation](/screenshots/Sedimentation.jpg)

Rivers and erosion caused by them is calculated. Algorithm is follows. Start many streams (amount set by "erosion" slider). A steam starts from random point, then goes down the elevation. At each step, if we can go downwards, erode some elevation proportional to the elevation difference. If we can't, fill the current point with a sediment to the height of the lowest neighbors plus some low constant. We do that until we go to the elevation of -0.2. I.e. process does not stop exactly at the seas level, but continues a bit further, eroding or filling up the seas. It eliminates most of smallish inland seas.

Here how this changes the terrain:

![Erosion Gif](/screenshots/ErosionBigGif.gif)

After erosion emulation is complete, the same algorithm also makes "riversShown" streams, but now their path is remembered and displayed as tivers/lakes.

# Prevailing Winds

![Winds Simulation](/screenshots/WindSimulation.jpg)

In order to emulate humidity (and possible, for other things later) we need to know prevailing wind direction and strength. Mimicing Earth, wind depends on latitude: Trade Winds blow from the East near equator, Westerlies blows from the West further from it. Also, wind strength reduced near high altitudes. Only horisontal (west-east) component is calculated. Result is smoothed by using "blur" canvas fitler. On the ind map, blue means wind blows from the East (i.e. to the left), and red means it blows to the right.

    let wind = elevation.map(
      (h, i) =>
        Math.cos((Math.abs(0.5 - i / mapSize) * 4 + 0.85) * Math.PI) /
        (h<0?1:(1 + 5 * h * h))
    );

# Humidity

![Humidity](/screenshots/HumiditySimulation.jpg)

Basically, we repeatedly grab some humidity at the random point of the map, then add some percentage of it where wind takes it.

JS Canvas capabilities are used heavily here. Initial humidity map is a monochrome image with certain alpha value over the water and zero elsewhere. It may be blurred a bit. Then, in cycle, random spots are taken, and wind speed there is noted. Then semi-random direction is picked roughly in the prevailing wind direction. A fragment of humidity image is cut out and displaced in that direction, added to same very image. Final result is blurred.

# Temperature 

![Temperature](/screenshots/TemperatureSimulation.jpg)

Average temperature (in Celsius) is calculated from latitude and altitude. Effect of latitude is somewhat reduced in high humidity area, to simulate of softer climate from sea winds.

    let temperature = elevation.map(
      (e, i) =>
        averageTemperature +
        35 -
        (120 * Math.abs(0.5 - i / mapSize)) / (0.7 + 0.6 * humidity[i]) -
        Math.max(0, e) * 30
    );

# Biomes

![Biomes](/screenshots/BiomesSimulation.png)

Biome is calculated from humidity and temperature, according the following table.

    // -> temperature V humidity
    const biomeTable = [
      [TUNDRA, STEPPE, SAVANNA, DESERT],
      [TUNDRA, SHRUBLAND, GRASSLAND, GRASSLAND],
      [SNOW, SHRUBLAND, GRASSLAND, TEMPERATE_FOREST],
      [SNOW, CONIFEROUS_FOREST, TEMPERATE_FOREST, TEMPERATE_FOREST],
      [TAIGA, CONIFEROUS_FOREST, DENSE_FOREST, DENSE_FOREST],
      [TAIGA, CONIFEROUS_FOREST, DENSE_FOREST, RAIN_FOREST],
    ];

Also, TUNDRA becomes MOUNTAIN at the altitude above 0.5.

# Satellite photo view

![Photo](/screenshots/PhotoSimulation.jpg)

Algorithm is similar to biomes, but is more gradient. Generally, it is yellower/whiter in dry area, greener/darker in humid areas,
blacker at high altitudes, white below 0 Celsius, lighter on equator-side slopes and darker on opposing slopes.

