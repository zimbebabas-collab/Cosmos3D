export type BodyCategory = 'star' | 'planet' | 'moon' | 'deep_space' | 'galaxy';

export type PlanetShaderType =
  | 'sun'
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'moon'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'blackhole'
  | 'quasar'
  | 'pulsar'
  | 'nebula'
  | 'galaxy';

export interface CelestialBodyData {
  id: string;
  nameRu: string;
  subtitleRu: string;
  category: BodyCategory;
  shaderType: PlanetShaderType;
  /** Real equatorial radius in kilometers (for solar system) or effective visual radius in km-equivalent */
  radiusKm: number;
  /** Semi-major axis around parent in km (0 for Sun / independent deep space anchors) */
  semiMajorAxisKm: number;
  /** Parent body id for orbital motion (e.g. 'sun' or 'earth') */
  parentId?: string;
  /** Real orbital period in Earth days */
  orbitalPeriodDays: number;
  /** Initial orbital phase in radians so solar system starts in a scenic alignment */
  initialAngleRad: number;
  /** Sidereal rotation period in hours (negative = retrograde) */
  rotationPeriodHours: number;
  /** Axial tilt in degrees */
  axialTiltDeg: number;
  /** Whether body has solid rocky terrain that supports extreme surface close-up displacement */
  hasRockyTerrain: boolean;
  /** Atmosphere glow RGB tint (0..1) if present */
  atmosphereColor?: [number, number, number];
  /** Atmosphere thickness relative to radius */
  atmosphereScale?: number;
  /** Ring inner/outer radii relative to planet radius */
  rings?: {
    innerFactor: number;
    outerFactor: number;
    colorHex: string;
    opacity: number;
  };
  /** Deep space coordinates in light-years relative to Solar System (for galactic zoom / deep space views) */
  galacticPosLy: [number, number, number];
  /** True physical radius in light-years for galactic objects (nebula, galaxy, quasar jets) */
  galacticVisualRadiusLy?: number;
  /** Real astrophysical telemetry shown after scanning */
  stats: {
    diameterLabel: string;
    distanceLabel: string;
    gravityLabel: string;
    temperatureLabel: string;
    dayLengthLabel: string;
    atmosphereLabel: string;
  };
  descriptionRu: string;
  surfaceHighlightRu: string;
  /** Accent hex color strictly for subtle UI markers / orbital indicator */
  accentHex: string;
  /** Whether included in the 13-object expedition scan log */
  scannable: boolean;
}

export const AU_KM = 149_597_870.7;
export const LIGHT_YEAR_KM = 9_460_730_472_580.8;

/**
 * Verified NASA / IAU physical constants for the Solar System (1:1 real scale in kilometers)
 * plus major Milky Way & extragalactic marvels.
 */
export const CELESTIAL_CATALOG: CelestialBodyData[] = [
  {
    id: 'sun',
    nameRu: 'Солнце',
    subtitleRu: 'Жёлтый карлик G2V',
    category: 'star',
    shaderType: 'sun',
    radiusKm: 696_340,
    semiMajorAxisKm: 0,
    orbitalPeriodDays: 0,
    initialAngleRad: 0,
    rotationPeriodHours: 609.12,
    axialTiltDeg: 7.25,
    hasRockyTerrain: false,
    galacticPosLy: [0, 0, 0],
    stats: {
      diameterLabel: '1 392 680 км',
      distanceLabel: '0 а.е. (Центр системы)',
      gravityLabel: '274,0 м/с²',
      temperatureLabel: '5 778 К (фотосфера)',
      dayLengthLabel: '25,4 земных суток',
      atmosphereLabel: '73% H₂, 25% He, плазма',
    },
    descriptionRu:
      'Звезда главной последовательности, содержащая 99,86% массы Солнечной системы. На поверхности кипят конвективные гранулы размером с континенты.',
    surfaceHighlightRu: 'Конвективная плазма, солнечные пятна и корональные выбросы',
    accentHex: '#f59e0b',
    scannable: true,
  },
  {
    id: 'mercury',
    nameRu: 'Меркурий',
    subtitleRu: 'Планета земной группы',
    category: 'planet',
    shaderType: 'mercury',
    radiusKm: 2_439.7,
    semiMajorAxisKm: 57_909_050,
    parentId: 'sun',
    orbitalPeriodDays: 87.97,
    initialAngleRad: 1.15,
    rotationPeriodHours: 1407.6,
    axialTiltDeg: 0.03,
    hasRockyTerrain: true,
    galacticPosLy: [0, 0, 0],
    stats: {
      diameterLabel: '4 879 км',
      distanceLabel: '0,387 а.е. (57,9 млн км)',
      gravityLabel: '3,70 м/с²',
      temperatureLabel: '−180 … +430 °C',
      dayLengthLabel: '58,6 земных суток',
      atmosphereLabel: 'Разреженная экзосфера',
    },
    descriptionRu:
      'Ближайшая к Солнцу планета с гигантским железным ядром. Древняя силикатная кора изрезана ударными кратерами и тектоническими уступами.',
    surfaceHighlightRu: 'Силикатные равнины, ударные кратеры и острые терминаторные тени',
    accentHex: '#a8a29e',
    scannable: true,
  },
  {
    id: 'venus',
    nameRu: 'Венера',
    subtitleRu: 'Парниковый мир',
    category: 'planet',
    shaderType: 'venus',
    radiusKm: 6_051.8,
    semiMajorAxisKm: 108_208_000,
    parentId: 'sun',
    orbitalPeriodDays: 224.7,
    initialAngleRad: 2.35,
    rotationPeriodHours: -5832.5,
    axialTiltDeg: 177.36,
    hasRockyTerrain: true,
    atmosphereColor: [0.95, 0.72, 0.38],
    atmosphereScale: 1.032,
    galacticPosLy: [0, 0, 0],
    stats: {
      diameterLabel: '12 104 км',
      distanceLabel: '0,723 а.е. (108,2 млн км)',
      gravityLabel: '8,87 м/с²',
      temperatureLabel: '+464 °C (средняя)',
      dayLengthLabel: '243 земных суток (ретрогр.)',
      atmosphereLabel: '96,5% CO₂, облака H₂SO₄',
    },
    descriptionRu:
      'Планета, укутанная сверхплотной сернокислотной атмосферой с давлением в 92 земных. Под облаками скрыты раскалённые базальтовые плато.',
    surfaceHighlightRu: 'Суперротация серных облаков и тлеющие вулканические разломы',
    accentHex: '#eab308',
    scannable: true,
  },
  {
    id: 'earth',
    nameRu: 'Земля',
    subtitleRu: 'Обитаемый океанический мир',
    category: 'planet',
    shaderType: 'earth',
    radiusKm: 6_371.0,
    semiMajorAxisKm: 149_597_870.7,
    parentId: 'sun',
    orbitalPeriodDays: 365.256,
    initialAngleRad: 0.42,
    rotationPeriodHours: 23.934,
    axialTiltDeg: 23.44,
    hasRockyTerrain: true,
    atmosphereColor: [0.28, 0.62, 1.0],
    atmosphereScale: 1.022,
    galacticPosLy: [0, 0, 0],
    stats: {
      diameterLabel: '12 742 км',
      distanceLabel: '1,000 а.е. (149,6 млн км)',
      gravityLabel: '9,81 м/с²',
      temperatureLabel: '+15 °C (средняя)',
      dayLengthLabel: '23 ч 56 м',
      atmosphereLabel: '78% N₂, 21% O₂, 1% Ar',
    },
    descriptionRu:
      'Единственный известный мир с жидкими океанами, активной тектоникой плит и биосферой. На ночной стороне вдоль побережий и долин горят сети мегаполисов.',
    surfaceHighlightRu: 'Горные хребты, океаны, облачный слой и ночные огни городов с трассами',
    accentHex: '#38bdf8',
    scannable: true,
  },
  {
    id: 'moon',
    nameRu: 'Луна',
    subtitleRu: 'Естественный спутник Земли',
    category: 'moon',
    shaderType: 'moon',
    radiusKm: 1_737.4,
    semiMajorAxisKm: 384_400,
    parentId: 'earth',
    orbitalPeriodDays: 27.322,
    initialAngleRad: 0.9,
    rotationPeriodHours: 655.72,
    axialTiltDeg: 6.68,
    hasRockyTerrain: true,
    galacticPosLy: [0, 0, 0],
    stats: {
      diameterLabel: '3 475 км',
      distanceLabel: '384 400 км от Земли',
      gravityLabel: '1,62 м/с²',
      temperatureLabel: '−173 … +127 °C',
      dayLengthLabel: '27,3 земных суток',
      atmosphereLabel: 'Отсутствует (вакуум)',
    },
    descriptionRu:
      'Крупнейший спутник относительно массы своей планеты. Покрыта тёмными базальтовыми морями и светлыми анортозитовыми материками с лучевыми кратерами.',
    surfaceHighlightRu: 'Террасированные кратеры, базальтовые моря и рельеф реголита',
    accentHex: '#cbd5e1',
    scannable: true,
  },
  {
    id: 'mars',
    nameRu: 'Марс',
    subtitleRu: 'Пустынная планета',
    category: 'planet',
    shaderType: 'mars',
    radiusKm: 3_389.5,
    semiMajorAxisKm: 227_939_200,
    parentId: 'sun',
    orbitalPeriodDays: 686.98,
    initialAngleRad: 5.55,
    rotationPeriodHours: 24.623,
    axialTiltDeg: 25.19,
    hasRockyTerrain: true,
    atmosphereColor: [0.88, 0.48, 0.30],
    atmosphereScale: 1.018,
    galacticPosLy: [0, 0, 0],
    stats: {
      diameterLabel: '6 779 км',
      distanceLabel: '1,524 а.е. (227,9 млн км)',
      gravityLabel: '3,72 м/с²',
      temperatureLabel: '−63 °C (средняя)',
      dayLengthLabel: '24 ч 37 м',
      atmosphereLabel: '95% CO₂, разрежённая',
    },
    descriptionRu:
      'Четвёртая планета системы с гигантским каньоном долины Маринер, щитовым вулканом Олимп и полярными шапками из водяного и сухого льда.',
    surfaceHighlightRu: 'Оксидно-железные каньоны, кратеры, базальтовые плато и полярный лёд',
    accentHex: '#f97316',
    scannable: true,
  },
  {
    id: 'jupiter',
    nameRu: 'Юпитер',
    subtitleRu: 'Газовый гигант',
    category: 'planet',
    shaderType: 'jupiter',
    radiusKm: 69_911,
    semiMajorAxisKm: 778_570_000,
    parentId: 'sun',
    orbitalPeriodDays: 4332.59,
    initialAngleRad: 3.65,
    rotationPeriodHours: 9.925,
    axialTiltDeg: 3.13,
    hasRockyTerrain: false,
    atmosphereColor: [0.86, 0.72, 0.56],
    atmosphereScale: 1.018,
    galacticPosLy: [0, 0, 0],
    stats: {
      diameterLabel: '139 822 км',
      distanceLabel: '5,204 а.е. (778,6 млн км)',
      gravityLabel: '24,79 м/с²',
      temperatureLabel: '−110 °C (верх облаков)',
      dayLengthLabel: '9 ч 55 м',
      atmosphereLabel: '89% H₂, 10% He, аммиак',
    },
    descriptionRu:
      'Крупнейшая планета Солнечной системы. Сверхбыстрое вращение вытягивает аммиачные облака в турбулентные зональные полосы и антициклоны.',
    surfaceHighlightRu: 'Зональные струйные течения, вихри и Большое Красное Пятно',
    accentHex: '#d97706',
    scannable: true,
  },
  {
    id: 'saturn',
    nameRu: 'Сатурн',
    subtitleRu: 'Окольцованный газовый гигант',
    category: 'planet',
    shaderType: 'saturn',
    radiusKm: 58_232,
    semiMajorAxisKm: 1_433_530_000,
    parentId: 'sun',
    orbitalPeriodDays: 10759.22,
    initialAngleRad: 4.82,
    rotationPeriodHours: 10.656,
    axialTiltDeg: 26.73,
    hasRockyTerrain: false,
    atmosphereColor: [0.92, 0.84, 0.64],
    atmosphereScale: 1.018,
    rings: {
      innerFactor: 1.24,
      outerFactor: 2.38,
      colorHex: '#d8c59e',
      opacity: 0.92,
    },
    galacticPosLy: [0, 0, 0],
    stats: {
      diameterLabel: '116 464 км',
      distanceLabel: '9,582 а.е. (1,43 млрд км)',
      gravityLabel: '10,44 м/с²',
      temperatureLabel: '−140 °C (верх облаков)',
      dayLengthLabel: '10 ч 39 м',
      atmosphereLabel: '96% H₂, 3% He',
    },
    descriptionRu:
      'Газовый гигант с обширной системой ледяных колец протяжённостью более 280 000 км, разделённых щелью Кассини и просветом Энке.',
    surfaceHighlightRu: 'Многослойные ледяные кольца с тенью планеты и золотистой атмосферой',
    accentHex: '#fcd34d',
    scannable: true,
  },
  {
    id: 'uranus',
    nameRu: 'Уран',
    subtitleRu: 'Ледяной гигант',
    category: 'planet',
    shaderType: 'uranus',
    radiusKm: 25_362,
    semiMajorAxisKm: 2_872_460_000,
    parentId: 'sun',
    orbitalPeriodDays: 30688.5,
    initialAngleRad: 1.95,
    rotationPeriodHours: -17.24,
    axialTiltDeg: 97.77,
    hasRockyTerrain: false,
    atmosphereColor: [0.55, 0.88, 0.92],
    atmosphereScale: 1.022,
    rings: {
      innerFactor: 1.55,
      outerFactor: 2.02,
      colorHex: '#94d2df',
      opacity: 0.28,
    },
    galacticPosLy: [0, 0, 0],
    stats: {
      diameterLabel: '50 724 км',
      distanceLabel: '19,20 а.е. (2,87 млрд км)',
      gravityLabel: '8,69 м/с²',
      temperatureLabel: '−195 °C',
      dayLengthLabel: '17 ч 14 м (на боку)',
      atmosphereLabel: '83% H₂, 15% He, 2,3% CH₄',
    },
    descriptionRu:
      'Ледяной гигант, вращающийся практически на боку с наклоном оси 97,8°. Метан в верхних слоях придаёт планете холодный бирюзовый оттенок.',
    surfaceHighlightRu: 'Метановая дымка, вертикальная система тонких колец и полярный пояс',
    accentHex: '#67e8f9',
    scannable: true,
  },
  {
    id: 'neptune',
    nameRu: 'Нептун',
    subtitleRu: 'Внешний ледяной гигант',
    category: 'planet',
    shaderType: 'neptune',
    radiusKm: 24_622,
    semiMajorAxisKm: 4_495_060_000,
    parentId: 'sun',
    orbitalPeriodDays: 60182,
    initialAngleRad: 0.12,
    rotationPeriodHours: 16.11,
    axialTiltDeg: 28.32,
    hasRockyTerrain: false,
    atmosphereColor: [0.25, 0.48, 0.98],
    atmosphereScale: 1.024,
    galacticPosLy: [0, 0, 0],
    stats: {
      diameterLabel: '49 244 км',
      distanceLabel: '30,05 а.е. (4,50 млрд км)',
      gravityLabel: '11,15 м/с²',
      temperatureLabel: '−200 °C',
      dayLengthLabel: '16 ч 06 м',
      atmosphereLabel: '80% H₂, 19% He, 1,5% CH₄',
    },
    descriptionRu:
      'Самая удалённая планета системы, где бушуют сверхзвуковые ветры скоростью свыше 2 100 км/ч и плывут белые метановые перистые облака.',
    surfaceHighlightRu: 'Кобальтовые штормы, перистые облака метана и Большое Тёмное Пятно',
    accentHex: '#3b82f6',
    scannable: true,
  },
  {
    id: 'gargantua',
    nameRu: 'Гаргантюа (Sgr A*)',
    subtitleRu: 'Сверхмассивная чёрная дыра',
    category: 'deep_space',
    shaderType: 'blackhole',
    radiusKm: 12_000_000, // Schwarzschild horizon scale (~4M-100M solar masses visual scale)
    semiMajorAxisKm: 0,
    orbitalPeriodDays: 0,
    initialAngleRad: 0,
    rotationPeriodHours: 1.5,
    axialTiltDeg: 14,
    hasRockyTerrain: false,
    galacticPosLy: [0, 0, -26_670],
    galacticVisualRadiusLy: 850,
    stats: {
      diameterLabel: '24 000 000 км (горизонт)',
      distanceLabel: '26 670 св. лет (центр Галактики)',
      gravityLabel: '∞ на горизонте событий',
      temperatureLabel: '10¹⁰ К (аккреционный диск)',
      dayLengthLabel: 'Спин a* = 0,998 (Керр)',
      atmosphereLabel: 'Релятивистская плазма и фотонная сфера',
    },
    descriptionRu:
      'Быстровращающаяся чёрная дыра Керра. Чудовищное искривление пространства-времени заворачивает свет дальней стороны аккреционного диска над и под тенью горизонта событий.',
    surfaceHighlightRu: 'Гравитационное линзирование, доплеровское смещение и замедление времени',
    accentHex: '#fbbf24',
    scannable: true,
  },
  {
    id: 'quasar',
    nameRu: 'Квазар 3C 273',
    subtitleRu: 'Активное галактическое ядро',
    category: 'deep_space',
    shaderType: 'quasar',
    radiusKm: 45_000_000,
    semiMajorAxisKm: 0,
    orbitalPeriodDays: 0,
    initialAngleRad: 0,
    rotationPeriodHours: 4.0,
    axialTiltDeg: 22,
    hasRockyTerrain: false,
    galacticPosLy: [38_000, 12_000, -45_000],
    galacticVisualRadiusLy: 3_200,
    stats: {
      diameterLabel: 'Светимость 4 × 10¹² L☉',
      distanceLabel: '2,4 млрд св. лет (созв. Дева)',
      gravityLabel: 'Масса ~8,86 × 10⁸ M☉',
      temperatureLabel: '10¹² К (синхротронное ядро)',
      dayLengthLabel: 'Джеты длиной 200 000 св. лет',
      atmosphereLabel: 'Релятивистские струи плазмы (0,99c)',
    },
    descriptionRu:
      'Один из самых ярких объектов Вселенной. Сверхмассивная чёрная дыра поглощает материю с такой скоростью, что магнитные поля выбрасывают двойные релятивистские джеты.',
    surfaceHighlightRu: 'Двойные плазменные джеты, ударные узлы и ослепительный аккреционный вихрь',
    accentHex: '#38bdf8',
    scannable: true,
  },
  {
    id: 'pulsar',
    nameRu: 'Пульсар PSR B1919+21',
    subtitleRu: 'Магнитная нейтронная звезда',
    category: 'deep_space',
    shaderType: 'pulsar',
    radiusKm: 18_000, // visual magnetosphere envelope around ultra-dense 20 km neutron star
    semiMajorAxisKm: 0,
    orbitalPeriodDays: 0,
    initialAngleRad: 0,
    rotationPeriodHours: 0.00037,
    axialTiltDeg: 34,
    hasRockyTerrain: false,
    galacticPosLy: [-14_000, 3_500, -11_000],
    galacticVisualRadiusLy: 420,
    stats: {
      diameterLabel: '20 км (ядро 1,4 M☉)',
      distanceLabel: '2 283 св. года (созв. Лисичка)',
      gravityLabel: '2 × 10¹² м/с²',
      temperatureLabel: '600 000 К (поверхность)',
      dayLengthLabel: 'Период импульса 1,337 с',
      atmosphereLabel: 'Дипольная магнитосфера 10¹² Гс',
    },
    descriptionRu:
      'Сверхплотный остаток сверхновой, вращающийся как космический маяк. Из магнитных полюсов вырываются узкие конусы синхротронного излучения.',
    surfaceHighlightRu: 'Вращающиеся релятивистские лучи-маяки и линии магнитного диполя',
    accentHex: '#818cf8',
    scannable: true,
  },
  {
    id: 'galaxy',
    nameRu: 'Млечный Путь',
    subtitleRu: 'Спиральная галактика SBbc',
    category: 'galaxy',
    shaderType: 'galaxy',
    radiusKm: 100_000, // used in galactic mode (100,000 ly diameter)
    semiMajorAxisKm: 0,
    orbitalPeriodDays: 0,
    initialAngleRad: 0,
    rotationPeriodHours: 0,
    axialTiltDeg: 0,
    hasRockyTerrain: false,
    galacticPosLy: [0, 0, -26_670],
    galacticVisualRadiusLy: 52_850,
    stats: {
      diameterLabel: '105 700 световых лет',
      distanceLabel: 'Рукав Ориона (26,7 тыс. св. лет от центра)',
      gravityLabel: '100–400 млрд звёзд',
      temperatureLabel: 'Межзвёздный газ и пылевые рукава',
      dayLengthLabel: 'Галактический год: 230 млн лет',
      atmosphereLabel: 'Спиральные рукава Персея, Стрельца, Ориона',
    },
    descriptionRu:
      'Наша спиральная галактика с перемычкой. С галактического масштаба Солнечная система — лишь микроскопическая точка на краю рукава Ориона.',
    surfaceHighlightRu: 'Спиральные рукава, золотое галактическое ядро, туманности и центр Sgr A*',
    accentHex: '#c084fc',
    scannable: false,
  },
];

export const BODY_BY_ID: Record<string, CelestialBodyData> = Object.fromEntries(
  CELESTIAL_CATALOG.map((b) => [b.id, b]),
);

export const SCANNABLE_BODIES = CELESTIAL_CATALOG.filter((b) => b.scannable);
