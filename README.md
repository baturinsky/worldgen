# Voronoi-less Terrain Generator
Fairly fast, fairly simple and fairly realistic terrain generator.

![Screenshot](/screenshots/index.png)

![Screenshot](/screenshots/ThreeMaps.png)

I tried to make a terrain generator that is simpler and easier to understand, yet sufficiently good.

I don't use Voronoi or any other polygonal partition - it's a simple 2d grid.
That lets me use canvas drawing for accelerating certain taxing simulation step.

So, it works as follows.

* Generate two 2d noises - "noise" and "crust". I'm doing it by drawing several thousands of semi-transparent gradient ellipses on vanvas,
then taking an alpha of result.

*  "Noise" is interpreted as a vertical elevation displacement. "crust" is a more complex and abstract thing. It's main function
is simulating tectonic movement effects, such as mountain ranges, island chains, peninsulas etc. It 's done by taking a function from "crust" 
that is high around it's median and low  everywhere else. This value is called "tectonic" and forms interesing long shapes.

* Noise, crust and tectonic are summed together with some weights. Bigger weight for "crust" makes mountain ranges appear at the edge of landmasses.
Bigger weight for "tectonic" makes more mountain ranges etc.

* Resulting value is ajusted dependent on desired sea percentage and dry land "flatness". Result is a value between -1 and 1, with sea level being at 0.

* Average wind vector is calculated. Mimicing Earth, it depends on latitude: Trade Winds near equator, Westerlies further from it.
also, it is reduced near high altitudes. Only horisontal (west-east) component is calculated. It is needed to simulate humidity.
Result is smoothed by using "blur" canvas fitler.

Here is how latitude affects wind direction:

![Prevailing Winds](/screenshots/Prevailing&#32;Winds.png)

* Rivers and erosion caused by them is calculated. Algorithm is follows. Start many rivers. A river starts from random point, then go down the elevation.
At each step, if we can go downwards, erode some elevation proportional to the elevation difference. If we can't, fill the current point with a sediment to the height of the lowest neighbors plus some low constant. We do that until we go to the elevation of -0.2. I.e. process does not stop exactly at the seas level, but continues a bit further, eroding or filling up the seas. It eliminates most of smallish inland seas.

* "erosion" amount rivers are simulating just for the sake of erosion/sedimentation without rememebering the flow. Then "riversShown" rivers are simulated, but their flow path is remembered and displayed.

![Erosion Gif](/screenshots/ErosionBigGif.gif)

* Humidity is emulated. Iinitial humidity map is an image with some of alpha over water and zero elsewhere. It may be blurred a bit.
Then, random spots are taken, and wind speed there is noted. Then semi-random direction is picked roughly in wind direction. A fragment of humidity image
is cut out and displaced in that direction, added to same very image. Final result is blurred.

* Average temperature is calculated from latitude and altitude. Effect of latitude is somewhat reduced in high humidity area, to simulate of softer climate from sea winds.

* Biome is calculated from humidity and temperature, and for "mountain shrubland" biome, altitude.