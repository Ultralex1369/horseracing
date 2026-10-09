// Each track is a closed loop of control points (smoothed in game.js).
// mud / carrots entries are [position around the loop 0-1, sideways offset -1..1].
// Keep different parts of a loop farther apart than its width, or the lap counter can get confused.

const ring = (n, radii) =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const [rx, ry] = radii(i);
    return [400 + rx * Math.cos(t), 300 + ry * Math.sin(t)];
  });

export const TRACKS = [
  {
    id: "meadow",
    name: "Meadow Loop",
    width: 100,
    grass: "#5f9f4a",
    dirt: "#c8a26b",
    pts: ring(12, () => [280, 190]),
    mud: [[0.12, 0.3], [0.45, -0.3], [0.78, 0.2]],
    carrots: [[0.08, 0], [0.25, -0.4], [0.42, 0.4], [0.6, 0], [0.85, -0.3]],
  },
  {
    id: "kidney",
    name: "Kidney Creek",
    width: 80,
    grass: "#7a9a45",
    dirt: "#b98b5a",
    pts: [
      [150, 120], [400, 90], [650, 120], [700, 260], [560, 330], [660, 450],
      [560, 530], [300, 510], [140, 540], [90, 380], [220, 300], [100, 220],
    ],
    mud: [[0.1, 0.3], [0.38, -0.3], [0.6, 0.3], [0.85, -0.2]],
    carrots: [[0.06, 0], [0.22, 0.3], [0.45, -0.3], [0.68, 0], [0.9, 0.3]],
  },
  {
    id: "daisy",
    name: "Daisy Ring",
    width: 80,
    grass: "#4f8f6a",
    dirt: "#d2b48c",
    pts: ring(12, (i) => (i % 2 ? [190, 150] : [255, 205])),
    mud: [[0.1, 0.3], [0.3, -0.3], [0.55, 0.3], [0.8, -0.3]],
    carrots: [[0.05, 0], [0.2, 0.3], [0.4, -0.3], [0.62, 0.3], [0.88, -0.3]],
  },
];
