/**
 * Solar Radiation & Heat Gain Calculations
 *
 * Translates global/direct/diffuse solar irradiance into transmitted heat gain:
 * 1. Global solar radiation on tilted/vertical facades
 * 2. Glazing Solar Heat Gain Coefficient (SHGC)
 * 3. Solar incidence angle factor
 */

export interface SolarGainResult {
  /** Transmitted solar heat gain in Watts */
  solarGainW: number;
  /** Effective vertical irradiance on window surface in W/m² */
  effectiveIrradianceWm2: number;
}

/**
 * Calculates solar heat gain transmitted through room windows.
 *
 * @param windowAreaM2 Total window glazing area in m²
 * @param windowOrientations Orientations of the windows in degrees from North
 * @param shortwaveGlobalWm2 Global horizontal irradiance (GHI) in W/m²
 * @param directNormalWm2 Direct beam irradiance on horizontal in W/m²
 * @param diffuseWm2 Diffuse horizontal irradiance (DHI) in W/m²
 * @param shgc Solar Heat Gain Coefficient of glazing (default: 0.65)
 * @param hourOfDay Solar hour (0-23) used for solar altitude approximation
 */
export function calculateWindowSolarGain(
  windowAreaM2: number,
  windowOrientations: { orientationDeg: number; areaM2: number }[],
  shortwaveGlobalWm2: number | null | undefined,
  directNormalWm2: number | null | undefined,
  diffuseWm2: number | null | undefined,
  shgc: number,
  hourOfDay = 12,
): SolarGainResult {
  if (windowAreaM2 <= 0 || !shortwaveGlobalWm2 || shortwaveGlobalWm2 <= 0) {
    return { solarGainW: 0, effectiveIrradianceWm2: 0 };
  }

  // During night hours (no sunlight)
  if (shortwaveGlobalWm2 <= 1.0) {
    return { solarGainW: 0, effectiveIrradianceWm2: 0 };
  }

  const ghi = shortwaveGlobalWm2;
  const dhi = (diffuseWm2 && diffuseWm2 > 0) ? diffuseWm2 : ghi * 0.3; // Default 30% diffuse
  const beamHorizontal = Math.max(0, ghi - dhi);

  // Approximate solar position (solar azimuth & altitude)
  // At solar noon (12:00), sun is in South (180° azimuth in northern hemisphere)
  // Solar elevation angle above horizon (sinusoidal peak at noon)
  const sunElevationRad = Math.max(0, Math.sin(((hourOfDay - 6) / 12) * Math.PI));
  const sunAzimuthDeg = (hourOfDay - 6) * 15; // 06:00 = 0° (East), 12:00 = 90° (South), 18:00 = 180° (West)

  let totalSolarGainW = 0;
  let totalEffectiveIrradianceWeighted = 0;

  if (windowOrientations.length > 0) {
    for (const win of windowOrientations) {
      const area = win.areaM2;
      // Angle between window surface normal and solar azimuth
      const azimuthDiffDeg = Math.abs(win.orientationDeg - sunAzimuthDeg);
      const cosTheta = Math.max(0, Math.cos((azimuthDiffDeg * Math.PI) / 180));

      // Direct beam on vertical facade: I_dir,vert = I_dir,horiz * cot(elevation) * cos(azimuthDiff)
      // Clamped to avoid division by zero near sunrise/sunset
      const cotElevation = sunElevationRad > 0.05 ? Math.cos(Math.asin(sunElevationRad)) / sunElevationRad : 0;
      const directVertical = beamHorizontal * cotElevation * cosTheta;

      // Diffuse radiation on vertical surface: isotropic sky view factor is 0.5
      const diffuseVertical = dhi * 0.5;

      // Ground reflected radiation: ground albedo ~0.2, ground view factor is 0.5
      const reflectedVertical = ghi * 0.2 * 0.5;

      const totalVerticalIrradiance = Math.min(1100, directVertical + diffuseVertical + reflectedVertical);

      // Solar gain transmitted: Q_solar = Area * I_vert * SHGC
      const gainW = area * totalVerticalIrradiance * shgc;
      totalSolarGainW += gainW;
      totalEffectiveIrradianceWeighted += totalVerticalIrradiance * area;
    }
  } else {
    // If specific window orientation is unannotated, use average vertical facade factor (~0.6 * GHI)
    const avgVerticalIrradiance = ghi * 0.6;
    totalSolarGainW = windowAreaM2 * avgVerticalIrradiance * shgc;
    totalEffectiveIrradianceWeighted = avgVerticalIrradiance * windowAreaM2;
  }

  const effectiveIrradianceWm2 =
    windowAreaM2 > 0 ? Math.round((totalEffectiveIrradianceWeighted / windowAreaM2) * 10) / 10 : 0;

  return {
    solarGainW: Math.round(totalSolarGainW * 10) / 10,
    effectiveIrradianceWm2,
  };
}
