import { COLOR_ACCENT_BLUE, COLOR_ACCENT_GREEN, COLOR_TEXT, COLOR_TEXT_DISABLED, COLOR_TEXT_MUTED, GLASS_DIVIDER, applyLabelStyle } from "./theme";
import { svgEl, createCardElement, createCornerButton } from "./primitives";
import { createSolvedContent, type SolvedStats } from "./solved-panel";
import type { GestureCubeStrings } from "../strings";

// Raw finger state of a hand: "one".."four" exclude the thumb, "open" = four + thumb.
export type HandFingerState = "absent" | "fist" | "one" | "two" | "three" | "four" | "open";

export interface HandStatusSnapshot {
  readonly left: HandFingerState;
  readonly right: HandFingerState;
  // left hand is a fist (unlocks); rotationActive is the real rotation state (with hysteresis)
  readonly unlocked: boolean;
  readonly rotationActive: boolean;
}

export interface GestureGuide {
  // left/right (layer-turn) panels
  readonly setSideVisible: (visible: boolean) => void;
  // middle (free-rotation) panel; shown only after the scramble
  readonly setMiddleVisible: (visible: boolean) => void;
  // true when opened via "?": changes the middle title and shows "✕" on narrow layouts
  readonly setManualMode: (active: boolean) => void;
  // live HUD sharing the middle panel's position; mutually exclusive with setMiddleVisible
  readonly setHandStatusVisible: (visible: boolean) => void;
  // called every tracking frame
  readonly updateHandStatus: (status: HandStatusSnapshot) => void;
  // end-of-game content; mutually exclusive with the HUD and the guide (app.ts decides)
  readonly setSolvedVisible: (visible: boolean) => void;
  readonly updateSolved: (stats: SolvedStats) => void;
  // "?" visibility is decided by app.ts
  readonly setHelpButtonVisible: (visible: boolean) => void;
  // Narrow layout anchors the combined panel to the hint pill. Reported explicitly because
  // reading the pill's opacity mid-transition returns the stale value.
  readonly setHintPanelVisible: (visible: boolean) => void;
  readonly remove: () => void;
}

// Wide: two side panels + a middle panel. Narrow: one combined panel.
const NARROW_LAYOUT_BREAKPOINT = 820;
// Wide-layout geometry is computed from the CONTAINER width in applyLayout (an embedding
// host may give the engine a box much smaller than the viewport); these are the bounds.
const SIDE_PANEL_MIN_PX = 220;
const SIDE_PANEL_MAX_PX = 320;
const MIDDLE_PANEL_MIN_PX = 340;
const MIDDLE_PANEL_MAX_PX = 480;
// larger side offset = closer to the center
const SIDE_OFFSET_MAX_PX = 225;
const SIDE_OFFSET_MIN_PX = 16;
// single gap value for every row item
const ROW_GAP = "1em"; // scales with the card font
// slow fade so panels don't pop
const FADE_TRANSITION = "opacity 0.8s ease";

const GREEN = COLOR_ACCENT_GREEN;
const BLUE = COLOR_ACCENT_BLUE;


// hand icons and arrows are white; only digits/mini-grid carry the accent color
const PANEL_ICON_COLOR = "#f8fafc";

// Hand silhouettes for 1–4 fingers (shared viewBox 191x236).
const HAND_ICON_PATH_BY_FINGER_COUNT: Readonly<Record<number, string>> = {
  1: "M 55.502 23.575 C 53.853 24.435, 51.670 25.894, 50.650 26.817 C 46.120 30.916, 46.001 32.009, 45.978 69.700 L 45.956 105.500 41.969 117.500 C 36.126 135.091, 35.431 139.859, 36.921 152.151 C 38.425 164.562, 41.881 175.967, 46.039 182.245 C 53.275 193.169, 65.957 201.934, 80 205.717 C 88.916 208.119, 109.005 208.060, 118 205.605 C 140.146 199.562, 153.988 183.321, 158.572 158 C 160.138 149.352, 160.499 104.856, 159.054 98.628 C 156.472 87.499, 142.454 82.540, 133.907 89.732 L 130.755 92.384 128.774 89.664 C 124.482 83.772, 114.646 82.090, 108.038 86.118 C 105.735 87.522, 104.448 87.843, 104.192 87.077 C 103.444 84.831, 98.720 79.907, 95.931 78.464 C 91.936 76.399, 85.121 76.629, 81.299 78.959 L 78.099 80.911 77.799 56.705 C 77.508 33.183, 77.434 32.408, 75.166 29.227 C 70.627 22.863, 61.757 20.314, 55.502 23.575 M 54.400 30.400 L 51 33.800 51 66.875 L 51 99.950 53.565 98.975 C 54.976 98.439, 59.944 98, 64.604 98 L 73.079 98 72.789 65.417 L 72.500 32.834 69.234 29.917 C 64.452 25.645, 58.977 25.823, 54.400 30.400 M 81.400 85.400 C 78.519 88.281, 78 89.502, 78 93.400 C 78 97.922, 78.055 98, 81.250 98.004 C 88.752 98.012, 94.993 105.050, 94.993 113.500 C 94.993 120.754, 91.077 126.178, 83.500 129.420 C 81.508 130.272, 85.595 131.970, 89.673 131.985 C 93.011 131.997, 94.462 131.384, 96.923 128.923 L 100 125.846 100 106.824 L 100 87.802 96.894 84.901 C 94.421 82.591, 92.874 82, 89.294 82 C 85.516 82, 84.258 82.542, 81.400 85.400 M 110.763 89.511 C 106.112 92.127, 105 95.693, 105 108 C 105 120.463, 106.137 123.985, 110.967 126.483 C 114.755 128.442, 118.501 128.408, 121.928 126.384 C 126.395 123.745, 127.369 121.194, 127.806 111 C 128.272 100.109, 127.055 94.340, 123.610 91.103 C 120.541 88.220, 114.409 87.461, 110.763 89.511 M 137.756 92.755 C 133.381 95.467, 132 99.643, 132.002 110.151 C 132.003 121.481, 133.657 125.600, 139.312 128.362 C 142.734 130.034, 143.500 130.081, 146.796 128.827 C 148.839 128.049, 151.473 125.938, 152.734 124.067 C 154.709 121.136, 155 119.435, 155 110.820 C 155 104.540, 154.482 99.696, 153.579 97.534 C 151.101 91.604, 143.375 89.271, 137.756 92.755 M 55.299 103.624 C 50.721 105.881, 49.624 108.040, 44.923 124.025 C 40.942 137.560, 40.755 138.772, 41.351 147.161 C 42.010 156.452, 44.317 168.121, 46.551 173.467 C 48.551 178.256, 55.482 187.036, 60.250 190.822 C 70.274 198.781, 79.987 202.056, 95.500 202.704 C 115.054 203.522, 127.822 199.213, 139.018 188.018 C 149.779 177.256, 153.832 165.930, 154.705 144.179 L 155.281 129.859 151.890 131.926 C 145.702 135.698, 135.481 133.970, 131.110 128.413 L 129.274 126.079 127.102 128.392 C 124.932 130.701, 119.036 133, 115.283 133 C 114.191 133, 111.232 131.902, 108.707 130.559 L 104.117 128.118 100.259 131.976 C 94.006 138.230, 85.067 138.632, 78.597 132.951 C 76.706 131.290, 74.091 130, 72.618 130 C 67.337 130, 70.875 133.905, 78 135.940 C 90.128 139.404, 98.774 146.550, 103.944 157.383 C 107.743 165.342, 108.345 169.500, 105.699 169.500 C 104.436 169.500, 103.173 167.718, 101.475 163.539 C 96.431 151.129, 89.257 144.305, 77.684 140.909 C 69.640 138.549, 66 135.470, 66 131.026 C 66 125.464, 66.631 125, 74.206 125 C 82.880 125, 87.253 123.093, 89.516 118.326 C 92.500 112.036, 89.670 105.713, 82.685 103.067 C 78.190 101.363, 59.095 101.752, 55.299 103.624",
  2: "M 107.914 18.912 C 103.325 20.380, 100.287 22.978, 98.121 27.287 C 96.279 30.950, 93.740 42.689, 80.376 109.322 C 80.064 110.873, 79.633 111.967, 79.418 111.751 C 79.202 111.536, 74.554 94.384, 69.089 73.636 C 63.623 52.889, 58.290 34.245, 57.239 32.207 C 54.343 26.595, 49.841 24, 43 24 C 36.732 24, 32.389 26.199, 28.628 31.275 C 25.350 35.700, 26.098 41.929, 33.876 75 C 37.822 91.775, 42.211 110.712, 43.629 117.083 L 46.208 128.666 42.604 139.814 C 38.238 153.319, 37.838 163.377, 41.032 179.343 C 43.807 193.219, 47.680 200.839, 56.417 209.612 C 64.834 218.063, 73.402 222.735, 86.481 226.002 C 98.838 229.089, 117.839 228.502, 128.654 224.700 C 137.777 221.492, 145.163 216.720, 151.565 209.898 C 157.884 203.164, 161.323 197.342, 164.501 187.998 C 167.909 177.976, 168.889 168.260, 169.146 141.907 C 169.394 116.555, 169.033 114.964, 161.946 110.181 C 159.071 108.241, 157.505 107.917, 152.500 108.226 C 149.200 108.430, 145.863 108.800, 145.084 109.048 C 144.157 109.344, 143.441 108.465, 143.008 106.500 C 142.003 101.939, 140.320 99.346, 136.444 96.390 C 132.387 93.295, 124.606 92.070, 121.060 93.968 C 119.833 94.625, 118.594 94.927, 118.306 94.640 C 118.019 94.352, 120.177 82.503, 123.102 68.309 C 129.721 36.191, 130.124 31.297, 126.593 25.961 C 125.171 23.813, 122.704 21.381, 121.109 20.556 C 117.376 18.626, 111.210 17.857, 107.914 18.912 M 107.372 24.589 C 105.652 25.437, 103.499 27.564, 102.589 29.316 C 101.194 32, 84.519 111.035, 85.251 111.490 C 85.388 111.576, 87.645 112.440, 90.267 113.412 C 103.023 118.139, 104.831 135.096, 93.412 142.920 C 90.757 144.739, 88.161 145.418, 82.466 145.784 C 77.429 146.107, 75 146.668, 75 147.509 C 75 149.370, 77.004 150.672, 81.875 151.975 C 94.472 155.343, 104.870 163.943, 110.450 175.608 C 113.564 182.117, 114.385 188.500, 112.109 188.500 C 110.546 188.500, 110.325 188.139, 106.158 178.820 C 100.880 167.017, 93.058 160.433, 79.768 156.605 C 72.768 154.590, 69.995 151.875, 70.015 147.061 C 70.024 145.103, 70.361 142.987, 70.765 142.359 C 71.192 141.696, 75.195 141.068, 80.327 140.859 C 89.066 140.504, 89.188 140.463, 92.577 136.765 C 96.445 132.543, 97.076 127.981, 94.483 122.967 C 91.759 117.699, 88.470 116.813, 72.969 117.176 C 59.167 117.499, 59.116 117.509, 56.029 120.469 C 53.572 122.825, 52.011 126.353, 48.466 137.553 C 44.555 149.915, 44.002 152.774, 44.016 160.584 C 44.035 171.391, 47.049 186.480, 50.690 194 C 54.141 201.126, 64.737 211.628, 72.686 215.801 C 81.959 220.670, 92.402 223, 104.950 223 C 123.448 223, 137.385 217.688, 147.632 206.734 C 157.997 195.653, 162.637 183.150, 163.692 163.455 C 164.310 151.916, 163.810 150.114, 160.945 153.566 C 155.329 160.333, 141.867 159.186, 135.758 151.420 L 133.878 149.030 131.100 151.084 C 123.330 156.829, 111.865 154.745, 106.955 146.696 C 102.942 140.116, 102.429 143.787, 117.950 68 C 121.273 51.775, 123.994 36.797, 123.996 34.715 C 124.001 29.950, 121.534 26.121, 117.328 24.364 C 113.177 22.629, 111.256 22.673, 107.372 24.589 M 40.185 29.063 C 36.069 29.946, 32.294 33.385, 31.507 36.969 C 31.162 38.539, 32.188 45.137, 33.936 52.593 C 35.600 59.692, 39.684 77.401, 43.011 91.947 C 46.338 106.492, 49.234 118.567, 49.447 118.780 C 49.659 118.993, 50.810 118.190, 52.004 116.996 C 55.403 113.597, 60.368 112, 67.535 112 C 73.361 112, 74.071 111.795, 73.592 110.250 C 73.293 109.287, 71.888 104, 70.469 98.500 C 55.793 41.602, 53.009 32.360, 49.982 30.489 C 47.610 29.023, 43.298 28.395, 40.185 29.063 M 120.763 99.509 C 116.738 101.776, 115.557 104.844, 112.021 122.216 C 108.403 139.993, 108.681 143.212, 114.168 147.120 C 119.576 150.970, 128.208 149.217, 131.180 143.665 C 131.784 142.536, 133.734 134.425, 135.513 125.641 C 139.049 108.181, 138.932 105.164, 134.564 101.060 C 131.455 98.139, 124.568 97.365, 120.763 99.509 M 149.015 113.394 C 147.185 114.002, 144.809 115.685, 143.736 117.133 C 141.669 119.921, 138.106 134.978, 138.039 141.203 C 137.958 148.893, 142.139 153, 150.050 153 C 153.399 153, 154.826 152.373, 157.446 149.750 C 160.339 146.854, 160.932 145.231, 162.896 134.837 C 164.850 124.490, 164.942 122.796, 163.704 119.837 C 162.937 118.001, 161.578 115.893, 160.683 115.151 C 158.082 112.994, 152.672 112.179, 149.015 113.394",
  3: "M 84.218 33.663 C 82.413 34.553, 79.938 36.680, 78.718 38.390 C 76.632 41.315, 76.470 42.805, 76 63.500 L 75.500 85.500 73.225 68.653 C 71.974 59.386, 70.265 50.479, 69.427 48.858 C 66.914 43.999, 62.425 41.830, 55.764 42.258 C 49.271 42.674, 45.763 45.103, 43.301 50.886 C 41.988 53.969, 42.193 56.713, 45.583 81.516 L 49.307 108.760 46.904 112.130 C 44.585 115.380, 44.500 116.122, 44.500 133 C 44.500 148.690, 44.739 151.192, 46.812 157.190 C 57.656 188.574, 93.094 203.358, 122.692 188.844 C 131.879 184.339, 142.598 173.748, 146.826 165 C 151.806 154.692, 152.764 148.698, 153.429 123.685 C 153.992 102.538, 153.895 100.550, 152.102 96.498 C 149.552 90.733, 143.672 87.499, 137.321 88.369 C 132.140 89.080, 132.344 90.821, 135.082 69.321 L 137.164 52.971 134.977 48.452 C 131.203 40.656, 122.528 37.889, 115.046 42.094 C 110.141 44.851, 108.236 48.307, 107.032 56.633 C 106.486 60.410, 105.950 63.950, 105.840 64.500 C 105.731 65.050, 105.384 59.798, 105.070 52.828 C 104.543 41.104, 104.313 39.953, 102 37.449 C 97.126 32.172, 90.225 30.703, 84.218 33.663 M 83.923 39.923 L 81 42.846 81 74.423 L 81 106 91 106 L 101 106 101 75.547 C 101 42.744, 100.752 40.958, 95.855 38.425 C 91.372 36.107, 87.218 36.628, 83.923 39.923 M 116.888 46.500 C 115.451 47.280, 113.793 49.175, 113.203 50.710 C 112.612 52.244, 110.948 63.625, 109.505 76 C 108.061 88.375, 106.625 100.188, 106.312 102.250 C 105.775 105.796, 105.891 106, 108.438 106 C 113.923 106, 120.622 111.466, 121.613 116.750 C 122.741 122.762, 124.156 118.686, 124.351 108.867 C 124.468 102.983, 125.160 97.827, 126.214 95 C 127.136 92.525, 128.846 82.231, 130.015 72.125 C 131.707 57.489, 131.901 53.175, 130.968 50.924 C 128.708 45.468, 122.422 43.492, 116.888 46.500 M 49.589 50.077 C 48.165 51.769, 47 53.975, 47 54.980 C 47 56.989, 52.740 99.993, 53.543 104 C 54.041 106.484, 54.106 106.498, 63.522 106.181 C 72.398 105.883, 73 105.729, 73 103.752 C 73 100.034, 67.034 57.639, 65.968 53.786 C 64.672 49.097, 61.704 47, 56.366 47 C 52.917 47, 51.721 47.543, 49.589 50.077 M 133.888 94.500 C 130.005 96.610, 128.732 100.760, 129.149 109.950 C 129.467 116.945, 129.838 118.293, 132.060 120.515 C 133.461 121.916, 136.259 123.330, 138.277 123.658 C 141.536 124.186, 142.352 123.848, 145.570 120.630 L 149.193 117.007 148.847 107.416 C 148.519 98.344, 148.348 97.694, 145.694 95.412 C 142.504 92.670, 137.909 92.314, 133.888 94.500 M 51.923 113.923 L 49 116.846 49 131.713 C 49 153.223, 52.045 162.881, 62.220 173.639 C 72.726 184.747, 83.263 189.294, 98.500 189.294 C 113.737 189.294, 124.274 184.747, 134.780 173.639 C 144.183 163.697, 148 153.100, 148 136.935 L 148 126.234 143.929 127.636 C 139.272 129.241, 133.772 128.256, 129.905 125.125 C 127.647 123.296, 127.568 123.315, 122.789 126.888 C 111.254 135.510, 112.570 135, 101.838 135 L 91.972 135 94.571 138.928 C 97.480 143.324, 98.585 149.068, 97.567 154.496 C 96.753 158.833, 90.817 165.755, 86.282 167.653 C 82.449 169.258, 77.374 169.414, 76.473 167.956 C 75.465 166.325, 77.981 164, 80.754 164 C 87.112 164, 93.004 156.949, 92.996 149.349 C 92.988 140.636, 85.695 135.062, 74.250 135.022 C 68.751 135.003, 68 134.768, 68 133.071 C 68 131.236, 69.039 131.127, 89.297 130.821 C 113.072 130.463, 115.187 129.918, 116.786 123.745 C 117.934 119.316, 117.238 116.511, 114.252 113.524 L 111.727 111 83.287 111 L 54.846 111 51.923 113.923",
  4: "M 89.250 24.566 C 86.912 25.967, 84.986 27.425, 84.968 27.807 C 84.951 28.188, 84.315 29.319, 83.556 30.321 C 82.273 32.013, 81.960 32.031, 79.137 30.571 C 74.824 28.341, 68.489 28.597, 63.877 31.189 C 56.385 35.400, 56.559 34.490, 56 72.446 L 55.500 106.392 49.192 108.249 C 40.659 110.761, 33.874 117.195, 31.598 124.932 C 29.552 131.884, 29.556 144.113, 31.605 153.303 C 36.881 176.958, 56.261 197.104, 80 203.612 C 90.330 206.443, 108.298 206.041, 118.278 202.756 C 139.245 195.852, 155.389 180.094, 162.712 159.383 L 165.500 151.500 165.500 112.824 C 165.500 75.364, 165.435 74.060, 163.441 71.324 C 160.159 66.820, 153.348 63.762, 148.101 64.437 C 145.681 64.748, 143.165 65.448, 142.509 65.993 C 141.853 66.537, 141.020 66.687, 140.658 66.325 C 140.296 65.963, 140 59.958, 140 52.981 C 140 41.443, 139.794 39.991, 137.726 36.922 C 132.779 29.581, 123.982 26.890, 116.902 30.551 C 114.051 32.025, 113.808 31.988, 111.985 29.801 C 110.930 28.535, 110.052 27.245, 110.033 26.934 C 110.015 26.623, 108.251 25.385, 106.114 24.184 C 100.779 21.186, 94.659 21.324, 89.250 24.566 M 91.636 31.636 L 89 34.273 89 70.636 L 89 107 93.532 107 C 99.683 107, 104.193 109.075, 107.519 113.436 C 113.588 121.393, 110.973 132.973, 102.040 137.697 C 98.623 139.504, 96.084 140, 90.251 140 L 82.816 140 87.206 144.266 C 92.275 149.193, 95.567 155.431, 97.196 163.200 C 98.426 169.064, 97.956 171.696, 95.510 172.635 C 93.244 173.504, 91 171.156, 91 167.915 C 91 162.960, 87.167 154.576, 82.845 150.078 C 78.328 145.378, 70.307 141.186, 64.285 140.378 C 56.190 139.292, 55.852 139.119, 56.187 136.215 L 56.500 133.500 77 132.974 C 88.275 132.685, 98.304 132.068, 99.287 131.603 C 104.478 129.148, 105.103 119.800, 100.328 116.043 C 97.893 114.128, 96.374 114, 76.115 114.006 C 64.119 114.009, 52.819 114.478, 50.723 115.060 C 45.523 116.504, 40.458 121.233, 38.433 126.535 C 35.725 133.628, 36.819 149.244, 40.722 159.191 C 51.862 187.580, 81.186 203.692, 110.436 197.496 C 127.756 193.827, 143.725 181.802, 151.720 166.407 C 158.693 152.982, 159 150.692, 159 112.040 C 159 89.474, 158.633 77.183, 157.920 75.850 C 156.515 73.225, 151.221 71.044, 147.829 71.692 C 146.360 71.973, 144.110 73.317, 142.829 74.679 C 140.601 77.049, 140.486 77.918, 140.183 94.810 C 139.880 111.656, 139.482 113.925, 136.821 113.985 C 136.448 113.993, 135.436 113.293, 134.571 112.429 C 133.204 111.061, 133 106.387, 133 76.352 L 133 41.846 130.077 38.923 C 126.350 35.197, 122.244 35.082, 118.077 38.589 L 115 41.178 115 76.017 C 115 106.357, 114.797 111.060, 113.429 112.429 C 111.455 114.402, 110.545 114.402, 108.571 112.429 C 107.198 111.055, 107 106.043, 107 72.565 L 107 34.273 104.364 31.636 C 102.458 29.731, 100.694 29, 98 29 C 95.306 29, 93.542 29.731, 91.636 31.636 M 66.077 38.589 L 63 41.178 63 74.089 L 63 107 72 107 L 81 107 81 74.089 L 81 41.178 77.923 38.589 C 76.190 37.131, 73.603 36, 72 36 C 70.397 36, 67.810 37.131, 66.077 38.589",
};

// Rendered as outlines (stroke, not fill) to match the rest of the line-art panel.
function createHandIcon(fingerCount: number): SVGSVGElement {
  const svg = svgEl("svg", { viewBox: "0 0 191 236", width: "38", height: "47" });
  svg.style.flexShrink = "0";
  svg.style.display = "block";
  svg.appendChild(
    svgEl("path", {
      d: HAND_ICON_PATH_BY_FINGER_COUNT[fingerCount],
      fill: "none",
      stroke: PANEL_ICON_COLOR,
      "stroke-width": "3.5",
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    }),
  );
  return svg;
}

// Free-rotation demo: both hands are fists; the right one traces a circle (0–75%),
// pauses (75–100%), then loops. Web Animations API instead of injected CSS keyframes:
// no global <style>, each instance owns its animation.
const DEMO_ORBIT_KEYFRAMES: Keyframe[] = [
  { offset: 0.0000, transform: "translate(-0.00px, -0.00px)" },
  { offset: 0.0375, transform: "translate(-2.47px, -0.39px)" },
  { offset: 0.0750, transform: "translate(-4.70px, -1.53px)" },
  { offset: 0.1125, transform: "translate(-6.47px, -3.30px)" },
  { offset: 0.1500, transform: "translate(-7.61px, -5.53px)" },
  { offset: 0.1875, transform: "translate(-8.00px, -8.00px)" },
  { offset: 0.2250, transform: "translate(-7.61px, -10.47px)" },
  { offset: 0.2625, transform: "translate(-6.47px, -12.70px)" },
  { offset: 0.3000, transform: "translate(-4.70px, -14.47px)" },
  { offset: 0.3375, transform: "translate(-2.47px, -15.61px)" },
  { offset: 0.3750, transform: "translate(-0.00px, -16.00px)" },
  { offset: 0.4125, transform: "translate(2.47px, -15.61px)" },
  { offset: 0.4500, transform: "translate(4.70px, -14.47px)" },
  { offset: 0.4875, transform: "translate(6.47px, -12.70px)" },
  { offset: 0.5250, transform: "translate(7.61px, -10.47px)" },
  { offset: 0.5625, transform: "translate(8.00px, -8.00px)" },
  { offset: 0.6000, transform: "translate(7.61px, -5.53px)" },
  { offset: 0.6375, transform: "translate(6.47px, -3.30px)" },
  { offset: 0.6750, transform: "translate(4.70px, -1.53px)" },
  { offset: 0.7125, transform: "translate(2.47px, -0.39px)" },
  { offset: 0.7500, transform: "translate(0.00px, -0.00px)" },
  { offset: 1.0000, transform: "translate(0.00px, -0.00px)" },
];
const DEMO_ORBIT_DURATION_MS = 4000;

// Filled fist silhouette for the demo; the right hand is mirrored with CSS.
const FIST_ICON_PATH_D =
  "M366.214,129.976h-21.621V57.313c0-24.708-20.102-44.809-44.81-44.809c-13.976,0-26.475,6.435-34.698,16.493 C258.68,12.07,242.31,0,223.167,0c-19.277,0-35.747,12.236-42.058,29.348c-8.225-9.96-20.664-16.318-34.56-16.318 c-24.708,0-44.809,20.101-44.809,44.809v0.563c-8.125-8.198-19.383-13.285-31.81-13.285c-24.708,0-44.809,20.101-44.809,44.809 v139.655c0,55.446,18.966,109.714,53.454,153.087v38.013c0,3.59,2.91,6.5,6.5,6.5s6.5-2.91,6.5-6.5v-40.3 c0-1.491-0.513-2.936-1.451-4.094c-33.534-41.359-52.003-93.46-52.003-146.707v-33.708c8.125,8.198,19.382,13.285,31.809,13.285 c16.71,0,31.303-9.2,39.006-22.795c7.992,12.324,21.861,20.5,37.612,20.5c16.212,0,30.44-8.654,38.308-21.585 c7.869,12.929,22.096,21.581,38.307,21.581c4.686,0,9.243-0.723,13.62-2.124c8.616,12.478,23.009,20.676,39.287,20.676h13.992v2.058 h-13c-47.421,0-86,38.58-86,86c0,3.59,2.91,6.5,6.5,6.5s6.5-2.91,6.5-6.5c0-40.252,32.748-73,73-73h19.5c3.59,0,6.5-2.91,6.5-6.5 v-8.558h39.326c3.59,0,6.5-2.91,6.5-6.5s-2.91-6.5-6.5-6.5h-66.318c-19.144,0-34.719-15.575-34.719-34.718 s15.575-34.718,34.719-34.718h90.143c12.598,0,22.846,10.249,22.846,22.846v90.861c0,36.452-17.734,70.829-47.439,91.958 l-0.291,0.207c-21.61,15.372-34.512,40.38-34.512,66.899c0,3.59,2.91,6.5,6.5,6.5s6.5-2.91,6.5-6.5 c0-22.319,10.858-43.368,29.047-56.306l0.291-0.207c33.127-23.563,52.904-61.899,52.904-102.551v-90.861 C402.06,146.056,385.98,129.976,366.214,129.976z M101.741,164.35c0,17.54-14.27,31.809-31.81,31.809 c-17.539,0-31.809-14.27-31.809-31.809V89.927c0-17.54,14.27-31.809,31.809-31.809c17.54,0,31.81,14.269,31.81,31.809V164.35z M146.549,193.864c-17.539,0-31.809-14.269-31.809-31.809V57.84c0-17.54,14.27-31.809,31.809-31.809S178.358,40.3,178.358,57.84 v0.001h-0.004v104.21c0,0.027,0.002,0.053,0.002,0.079C178.315,179.635,164.063,193.864,146.549,193.864z M228.353,177.694 c0,5.322,0.889,10.438,2.504,15.222c-2.494,0.62-5.064,0.945-7.693,0.945c-17.513,0-31.765-14.227-31.809-31.731 c0-0.025,0.002-0.05,0.002-0.075V44.809c0-17.54,14.27-31.809,31.809-31.809s31.809,14.269,31.809,31.809v90.098 C239.218,142.708,228.353,158.953,228.353,177.694z M267.975,130.677V57.313c0-17.54,14.27-31.809,31.81-31.809 c17.539,0,31.809,14.269,31.809,31.809v72.663h-55.521C273.311,129.976,270.609,130.224,267.975,130.677z";

// same viewBox, rendered 75% larger
function createFistIcon(mirrored: boolean): SVGSVGElement {
  const svg = svgEl("svg", { viewBox: "0 0 427.183 427.183", width: "66.5", height: "75.25" });
  svg.style.flexShrink = "0";
  svg.style.display = "block";
  if (mirrored) svg.style.transform = "scaleX(-1)";
  svg.appendChild(svgEl("path", { d: FIST_ICON_PATH_D, fill: PANEL_ICON_COLOR }));
  return svg;
}

// Filled fully-open-hand silhouette, used by the HUD for the "open" state only.
const OPEN_HAND_ICON_PATH_D =
  "M382.5,69.429c-7.441,0-14.5,1.646-20.852,4.573c-4.309-23.218-24.7-40.859-49.148-40.859c-7.68,0-14.958,1.744-21.467,4.852C285.641,16.205,265.932,0,242.5,0c-23.432,0-43.141,16.206-48.533,37.995c-6.508-3.107-13.787-4.852-21.467-4.852c-27.57,0-50,22.43-50,50v122.222c-6.129-2.686-12.891-4.187-20-4.187c-27.57,0-50,22.43-50,50V354c0,72.233,58.766,131,131,131h118c72.233,0,131-58.767,131-131V119.429C432.5,91.858,410.07,69.429,382.5,69.429z M402.5,354c0,55.691-45.309,101-101,101h-118c-55.691,0-101-45.309-101-101V251.178c0-11.028,8.972-20,20-20s20,8.972,20,20v80h30V83.143c0-11.028,8.972-20,20-20s20,8.972,20,20v158.035h30V50c0-11.028,8.972-20,20-20c11.028,0,20,8.972,20,20v191.178h30V83.143c0-11.028,8.972-20,20-20s20,8.972,20,20v158.035h30v-121.75c0-11.028,8.972-20,20-20s20,8.972,20,20V354z";

function createOpenHandIcon(mirrored: boolean): SVGSVGElement {
  const svg = svgEl("svg", { viewBox: "0 0 485 485", width: "44", height: "44" });
  svg.style.flexShrink = "0";
  svg.style.display = "block";
  if (mirrored) svg.style.transform = "scaleX(-1)";
  svg.appendChild(svgEl("path", { d: OPEN_HAND_ICON_PATH_D, fill: PANEL_ICON_COLOR }));
  return svg;
}

// One fist layer; `orbit` animates the right hand along DEMO_ORBIT with linear timing.
function createSequencedHand(accentColor: string, orbit: boolean, mirrored: boolean): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.flexShrink = "0";
  wrap.style.filter = `drop-shadow(0 0 6px ${accentColor}77)`;
  if (orbit) wrap.animate(DEMO_ORBIT_KEYFRAMES, { duration: DEMO_ORBIT_DURATION_MS, iterations: Infinity, easing: "linear" });
  wrap.appendChild(createFistIcon(mirrored));
  return wrap;
}

// Free-rotation demo row: static left fist + orbiting right fist.
function createGestureDemoScene(): HTMLElement {
  const scene = document.createElement("div");
  scene.style.display = "flex";
  scene.style.alignItems = "center";
  scene.style.justifyContent = "center";
  scene.style.gap = "clamp(24px, 5vw, 36px)";
  scene.style.padding = "clamp(9px, 2vw, 14px) clamp(14px, 3vw, 20px)";
  scene.style.borderRadius = "14px";
  scene.style.background = "rgba(255,255,255,0.045)";
  scene.style.border = "1px solid rgba(255,255,255,0.05)";

  const leftHand = createSequencedHand(GREEN, false, false);
  const rightHand = createSequencedHand(BLUE, true, true);

  scene.append(leftHand, rightHand);
  return scene;
}

interface GuideRow {
  readonly fingerCount: number;
  readonly arrow: string;
  readonly label: string;
  readonly quadrantIndex: number; // 0..3 (TL, TR, BL, BR)
}

// Arrow/quadrant are language-independent; labels come from strings.rowLabels (count 1..4).
interface GuideRowMeta {
  readonly fingerCount: number;
  readonly arrow: string;
  readonly quadrantIndex: number;
}

// Visual legend only — must match FINGER_COUNT_TO_DIRECTION in layer-swipe.ts.
const LEFT_HAND_ROW_META: readonly GuideRowMeta[] = [
  { fingerCount: 1, arrow: "→", quadrantIndex: 0 },
  { fingerCount: 2, arrow: "←", quadrantIndex: 1 },
  { fingerCount: 3, arrow: "↑", quadrantIndex: 2 },
  { fingerCount: 4, arrow: "↓", quadrantIndex: 3 },
];

// Must match FINGER_COUNT_TO_QUADRANT in face-grid.ts.
const RIGHT_HAND_ROW_META: readonly GuideRowMeta[] = [
  { fingerCount: 1, arrow: "", quadrantIndex: 0 },
  { fingerCount: 2, arrow: "", quadrantIndex: 1 },
  { fingerCount: 3, arrow: "", quadrantIndex: 2 },
  { fingerCount: 4, arrow: "", quadrantIndex: 3 },
];

function buildRows(meta: readonly GuideRowMeta[], rowLabels: readonly [string, string, string, string]): readonly GuideRow[] {
  return meta.map((m, i) => ({ ...m, label: rowLabels[i] }));
}

// inactive cells are outlined, only the active one is filled
function createMiniGrid(activeIndex: number, accentColor: string): HTMLElement {
  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(2, 1fr)";
  grid.style.gap = "4px";
  grid.style.width = "2.75em";
  grid.style.height = "2.75em";
  grid.style.flexShrink = "0";
  for (let i = 0; i < 4; i++) {
    const cell = document.createElement("div");
    cell.style.borderRadius = "4px";
    if (i === activeIndex) {
      cell.style.background = accentColor;
      cell.style.border = `1px solid ${accentColor}`;
      cell.style.boxShadow = `0 0 8px ${accentColor}88`;
    } else {
      cell.style.background = "transparent";
      cell.style.border = "1.5px solid rgba(255,255,255,0.28)";
    }
    grid.appendChild(cell);
  }
  return grid;
}

// Arrow above a small uppercase label.
function createDirectionIndicator(arrow: string, label: string): HTMLElement {
  const col = document.createElement("div");
  col.style.display = "flex";
  col.style.flexDirection = "column";
  col.style.alignItems = "center";
  col.style.gap = "2px";
  col.style.flexShrink = "0";

  const arrowEl = document.createElement("span");
  arrowEl.textContent = arrow;
  arrowEl.style.fontSize = "1.9em";
  arrowEl.style.fontWeight = "900";
  arrowEl.style.webkitTextStroke = `2.5px ${PANEL_ICON_COLOR}`;
  arrowEl.style.lineHeight = "1";
  arrowEl.style.color = PANEL_ICON_COLOR;

  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  labelEl.style.fontSize = "0.6em";
  labelEl.style.opacity = "0.7";
  labelEl.style.letterSpacing = "0.05em";
  // may wrap to two lines; see the minmax(0,1fr) note in createPanelSection
  labelEl.style.textAlign = "center";
  labelEl.style.color = COLOR_TEXT;

  col.append(arrowEl, labelEl);
  return col;
}

interface PanelContent {
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly rows: readonly GuideRow[];
  readonly accentColor: string;
}

// Title + description + rows for one hand. No card/positioning; used by both layouts.
function createPanelSection(side: "left" | "right", content: PanelContent): HTMLElement {
  const section = document.createElement("div");
  section.style.display = "flex";
  section.style.flexDirection = "column";
  section.style.gap = "clamp(10px, 2.2vw, 15px)";

  const heading = document.createElement("div");
  const titleEl = document.createElement("div");
  titleEl.textContent = content.title;
  titleEl.style.fontWeight = "700";
  titleEl.style.fontSize = "1.15em";
  titleEl.style.color = content.accentColor;
  titleEl.style.letterSpacing = "0.02em";
  titleEl.style.textShadow = `0 0 18px ${content.accentColor}55`;
  const subtitleEl = document.createElement("div");
  subtitleEl.textContent = content.subtitle;
  subtitleEl.style.opacity = "0.75";
  subtitleEl.style.fontSize = "0.85em";
  subtitleEl.style.letterSpacing = "0.03em";
  const rule = document.createElement("div");
  rule.style.width = "1.75em";
  rule.style.height = "2px";
  rule.style.background = content.accentColor;
  rule.style.opacity = "0.6";
  rule.style.margin = "4px 0";
  heading.append(titleEl, subtitleEl, rule);
  section.appendChild(heading);

  const descEl = document.createElement("div");
  descEl.textContent = content.description;
  descEl.style.opacity = "0.65";
  descEl.style.fontSize = "0.82em";
  descEl.style.lineHeight = "1.3";
  descEl.style.marginBottom = "2px";
  section.appendChild(descEl);

  for (const row of content.rows) {
    // 3 equal columns. minmax(0,1fr) is required: with plain 1fr the third column's
    // min-content (label length) would shift columns 1–2 between rows.
    const cardRow = document.createElement("div");
    cardRow.style.display = "grid";
    cardRow.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
    cardRow.style.alignItems = "center";
    cardRow.style.justifyItems = "center";
    cardRow.style.gap = ROW_GAP;
    cardRow.style.padding = "clamp(9px, 2.2vw, 14px) clamp(10px, 2.6vw, 15px)";
    cardRow.style.borderRadius = "14px";
    cardRow.style.background = "rgba(255,255,255,0.045)";
    cardRow.style.border = "1px solid rgba(255,255,255,0.05)";

    const hand = createHandIcon(row.fingerCount);

    const countEl = document.createElement("span");
    countEl.textContent = String(row.fingerCount);
    countEl.style.fontSize = "1.4em";
    countEl.style.fontWeight = "700";
    countEl.style.color = content.accentColor;
    countEl.style.flexShrink = "0";

    cardRow.appendChild(hand);
    cardRow.appendChild(countEl);

    // right panel has no per-row text; the mini-grid already shows the cell
    if (side === "left") {
      cardRow.appendChild(createDirectionIndicator(row.arrow, row.label));
    } else {
      cardRow.appendChild(createMiniGrid(row.quadrantIndex, content.accentColor));
    }
    section.appendChild(cardRow);
  }

  return section;
}

// Free-rotation guide content. No card/positioning; created twice (wide + narrow)
// because one element cannot have two parents.
interface MiddleContentHandle {
  readonly element: HTMLElement;
  // title differs between auto-open and manual open (see setManualMode)
  readonly setManual: (active: boolean) => void;
}

function createMiddleContent(middle: { readonly title: string; readonly manualTitle: string; readonly description: string }): MiddleContentHandle {
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.alignItems = "center";
  wrap.style.gap = "clamp(10px, 2vw, 14px)";
  wrap.style.textAlign = "center";

  const titleEl = document.createElement("div");
  titleEl.textContent = middle.title;
  titleEl.style.fontWeight = "700";
  titleEl.style.fontSize = "1.3em";
  titleEl.style.color = "#f8fafc";
  titleEl.style.letterSpacing = "0.02em";

  const rule = document.createElement("div");
  rule.style.width = "1.75em";
  rule.style.height = "2px";
  // green → blue: both hands working together
  rule.style.background = `linear-gradient(90deg, ${GREEN}, ${BLUE})`;
  rule.style.opacity = "0.7";

  const demoRow = createGestureDemoScene();

  const descEl = document.createElement("div");
  descEl.textContent = middle.description;
  descEl.style.opacity = "0.7";
  descEl.style.fontSize = "0.92em";
  descEl.style.lineHeight = "1.3";

  wrap.append(titleEl, rule, demoRow, descEl);

  function setManual(active: boolean) {
    titleEl.textContent = active ? middle.manualTitle : middle.title;
  }

  return { element: wrap, setManual };
}

// Shared by the lock icon and the status text: locked (grey), ready (amber: left fist,
// right not grabbing yet), active (green).
type RotationState = "locked" | "ready" | "active";
const ROTATION_STATE_COLOR: Readonly<Record<RotationState, string>> = { locked: COLOR_TEXT_MUTED, ready: "#fbbf24", active: GREEN };

interface LockIconHandle {
  readonly element: HTMLElement;
  readonly setState: (state: RotationState) => void;
}

// Padlock drawn with two divs (shackle + body). The open state shifts and tilts the shackle.
function createLockIcon(): LockIconHandle {
  const wrap = document.createElement("div");
  wrap.style.position = "relative";
  // scaled with the hand icons
  wrap.style.width = "1.6em";
  wrap.style.height = "1.75em";
  wrap.style.flexShrink = "0";

  const shackle = document.createElement("div");
  shackle.style.position = "absolute";
  shackle.style.top = "0";
  shackle.style.left = "50%";
  shackle.style.width = "0.9em";
  shackle.style.height = "0.75em";
  shackle.style.borderRadius = "8px 8px 0 0";
  shackle.style.borderStyle = "solid";
  shackle.style.borderWidth = "3px";
  shackle.style.borderBottom = "none";
  shackle.style.boxSizing = "border-box";
  shackle.style.transformOrigin = "bottom center";
  shackle.style.transition = "transform 0.35s ease, border-color 0.3s ease";
  shackle.style.transform = "translateX(-50%)";

  const body = document.createElement("div");
  body.style.position = "absolute";
  body.style.bottom = "0";
  body.style.left = "50%";
  body.style.transform = "translateX(-50%)";
  body.style.width = "1.4em";
  body.style.height = "0.95em";
  body.style.borderRadius = "3px";
  body.style.transition = "background 0.3s ease, box-shadow 0.3s ease";

  wrap.append(shackle, body);

  function setState(state: RotationState) {
    const color = ROTATION_STATE_COLOR[state];
    shackle.style.borderColor = color;
    // the shackle opens only when rotation is really active, not on "ready"
    shackle.style.transform = state === "active" ? "translateX(calc(-50% + 5px)) rotate(22deg)" : "translateX(-50%)";
    body.style.background = color;
    body.style.boxShadow = state === "active" ? `0 0 10px ${color}88` : "none";
  }
  setState("locked");

  return { element: wrap, setState };
}

interface HandStatusSectionHandle {
  readonly element: HTMLElement;
  // on "absent" keep the last icon (faded) to avoid a jump
  readonly setState: (finger: HandFingerState, active: boolean, text: string) => void;
}

const FINGER_ICON_KEYS: readonly Exclude<HandFingerState, "absent">[] = ["fist", "one", "two", "three", "four", "open"];

// One hand section of the HUD. All 6 icons are created up front and toggled with display
// so per-frame updates are cheap.
function createHandStatusSection(accentColor: string, mirrored: boolean, label: string): HandStatusSectionHandle {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.gap = "clamp(6px, 1.6vw, 10px)";
  row.style.flex = "1";
  row.style.justifyContent = "center";
  row.style.minWidth = "0";

  const iconBox = document.createElement("div");
  iconBox.style.position = "relative";
  // icon grown without increasing panel height; gaps reduced to compensate
  iconBox.style.width = "2.75em";
  iconBox.style.height = "2.75em";
  iconBox.style.flexShrink = "0";
  iconBox.style.transition = "filter 0.3s ease, opacity 0.3s ease";

  const icons: Record<Exclude<HandFingerState, "absent">, SVGSVGElement> = {
    fist: createFistIcon(mirrored),
    one: createHandIcon(1),
    two: createHandIcon(2),
    three: createHandIcon(3),
    four: createHandIcon(4),
    open: createOpenHandIcon(mirrored),
  };
  const slots = {} as Record<Exclude<HandFingerState, "absent">, HTMLElement>;
  for (const key of FINGER_ICON_KEYS) {
    const slot = document.createElement("div");
    slot.style.position = "absolute";
    slot.style.inset = "0";
    slot.style.display = "none";
    slot.style.alignItems = "center";
    slot.style.justifyContent = "center";
    // the 6 icons have different intrinsic sizes; contain them in the same 36px box
    icons[key].style.maxWidth = "100%";
    icons[key].style.maxHeight = "100%";
    icons[key].style.width = "auto";
    icons[key].style.height = "auto";
    slot.appendChild(icons[key]);
    iconBox.appendChild(slot);
    slots[key] = slot;
  }
  let currentFinger: Exclude<HandFingerState, "absent"> = "fist";
  slots[currentFinger].style.display = "flex";

  const textCol = document.createElement("div");
  textCol.style.display = "flex";
  textCol.style.flexDirection = "column";
  textCol.style.gap = "1px";
  textCol.style.minWidth = "0";

  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  applyLabelStyle(labelEl);

  const statusEl = document.createElement("span");
  statusEl.style.fontSize = "1.1em";
  statusEl.style.fontWeight = "700";
  statusEl.style.letterSpacing = "0.02em";
  statusEl.style.transition = "color 0.3s ease";
  statusEl.style.whiteSpace = "nowrap";

  textCol.append(labelEl, statusEl);
  row.append(iconBox, textCol);

  function setState(finger: HandFingerState, active: boolean, text: string) {
    if (finger !== "absent" && finger !== currentFinger) {
      slots[currentFinger].style.display = "none";
      slots[finger].style.display = "flex";
      currentFinger = finger;
    }
    statusEl.textContent = text;
    const present = finger !== "absent";
    statusEl.style.color = !present ? COLOR_TEXT_DISABLED : active ? accentColor : COLOR_TEXT;
    iconBox.style.opacity = present ? "1" : "0.35";
    iconBox.style.filter = active ? `drop-shadow(0 0 6px ${accentColor}88)` : "none";
  }

  return { element: row, setState };
}

interface HandStatusContentHandle {
  readonly element: HTMLElement;
  readonly update: (status: HandStatusSnapshot) => void;
}

// HandFingerState → text, shared by both hands.
function textForFinger(strings: GestureCubeStrings["gestureGuide"]["handStatus"], finger: HandFingerState): string {
  switch (finger) {
    case "absent":
      return strings.handAbsent;
    case "fist":
      return strings.handFist;
    case "one":
      return strings.handOneFinger;
    case "two":
      return strings.handTwoFingers;
    case "three":
      return strings.handThreeFingers;
    case "four":
      return strings.handFourFingers;
    case "open":
      return strings.handFullyOpen;
  }
}

// Live HUD: [left hand] | [lock + rotation state] | [right hand]. Created twice (wide + narrow).
function createHandStatusContent(strings: GestureCubeStrings["gestureGuide"]["handStatus"]): HandStatusContentHandle {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.gap = "clamp(8px, 2vw, 13px)";
  row.style.width = "100%";
  row.style.boxSizing = "border-box";

  const leftSection = createHandStatusSection(GREEN, false, strings.leftLabel);
  const rightSection = createHandStatusSection(BLUE, true, strings.rightLabel);

  const middleCol = document.createElement("div");
  middleCol.style.display = "flex";
  middleCol.style.flexDirection = "column";
  middleCol.style.alignItems = "center";
  middleCol.style.gap = "3px";
  middleCol.style.flexShrink = "0";

  const lockIcon = createLockIcon();

  const rotationLabelEl = document.createElement("span");
  rotationLabelEl.textContent = strings.rotationLabel;
  applyLabelStyle(rotationLabelEl);

  const rotationStatusEl = document.createElement("span");
  rotationStatusEl.style.fontSize = "1em";
  rotationStatusEl.style.fontWeight = "700";
  rotationStatusEl.style.letterSpacing = "0.02em";
  rotationStatusEl.style.textAlign = "center";
  rotationStatusEl.style.whiteSpace = "nowrap";
  rotationStatusEl.style.transition = "color 0.3s ease";

  middleCol.append(lockIcon.element, rotationLabelEl, rotationStatusEl);

  const dividerLeft = document.createElement("div");
  dividerLeft.style.width = "1px";
  dividerLeft.style.alignSelf = "stretch";
  dividerLeft.style.background = GLASS_DIVIDER;
  const dividerRight = dividerLeft.cloneNode() as HTMLElement;

  row.append(leftSection.element, dividerLeft, middleCol, dividerRight, rightSection.element);

  function update(status: HandStatusSnapshot) {
    // text is the raw hand state; color still reflects the interpreted state
    leftSection.setState(status.left, status.left === "fist", textForFinger(strings, status.left));
    rightSection.setState(status.right, status.rotationActive, textForFinger(strings, status.right));

    const rotationState: RotationState = !status.unlocked ? "locked" : status.rotationActive ? "active" : "ready";
    rotationStatusEl.textContent =
      rotationState === "locked" ? strings.rotationLocked : rotationState === "ready" ? strings.rotationReady : strings.rotationActiveLabel;
    rotationStatusEl.style.color = ROTATION_STATE_COLOR[rotationState];
    lockIcon.setState(rotationState);
  }

  return { element: row, update };
}

// Wide: side panel, vertically centered.
function createPanel(container: HTMLElement, side: "left" | "right", content: PanelContent): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.position = "absolute";
  wrapper.style.top = "50%";
  wrapper.style.transform = "translateY(-50%)";
  wrapper.style[side] = `${SIDE_OFFSET_MIN_PX}px`; // set by applyLayout
  wrapper.style.width = `${SIDE_PANEL_MIN_PX}px`; // set by applyLayout
  wrapper.style.zIndex = "10"; // above the play-screen overlay
  wrapper.style.pointerEvents = "none";
  wrapper.style.boxSizing = "border-box";
  wrapper.style.transition = FADE_TRANSITION;
  // Start at 0: starting visible and being set to 0 on the first render would play the
  // fade transition and flash the panel on load.
  wrapper.style.opacity = "0";

  const card = createCardElement();
  card.appendChild(createPanelSection(side, content));
  wrapper.appendChild(card);
  container.appendChild(wrapper);
  return wrapper;
}

// Corner button of the guide: "?" when closed, "✕" when open (auto or manual). Separate
// instances for wide/narrow; visibility handled in updateHelpButtonVisibility.
export function createHelpButton(ariaLabel: string, onToggleHelp: () => void): HTMLButtonElement {
  return createCornerButton("?", ariaLabel, onToggleHelp);
}

function createCloseButton(ariaLabel: string, onClose: () => void): HTMLButtonElement {
  return createCornerButton("✕", ariaLabel, onClose);
}

// Wide middle panel: short, horizontal card between the side panels; `top` is aligned to
// the side panels at runtime (applyLayout). Guide content and the HUD share this wrapper
// and are mutually exclusive; the corner buttons live on the same card.
function createMiddlePanel(
  container: HTMLElement,
  middleContent: HTMLElement,
  statusContent: HTMLElement,
  solvedContent: HTMLElement,
  helpButton: HTMLElement,
  closeButton: HTMLElement,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.position = "absolute";
  wrapper.style.top = "0"; // set by applyLayout
  wrapper.style.left = "50%";
  wrapper.style.transform = "translateX(-50%)";
  wrapper.style.width = `${MIDDLE_PANEL_MIN_PX}px`; // set by applyLayout
  wrapper.style.zIndex = "10";
  wrapper.style.pointerEvents = "none";
  wrapper.style.boxSizing = "border-box";
  // wrapper opacity is managed here so the card background fades with its content
  wrapper.style.transition = FADE_TRANSITION;
  // start at 0 (see createPanel)
  wrapper.style.opacity = "0";

  const card = createCardElement();
  card.style.position = "relative"; // anchor for the corner button
  card.style.padding = "1.2em";
  card.style.fontSize = "1em"; // inherits the container-derived size set in applyLayout
  card.append(middleContent, statusContent, solvedContent, helpButton, closeButton);
  wrapper.appendChild(card);
  container.appendChild(wrapper);
  return wrapper;
}

// Narrow: left|right sections side by side (bottom part of the combined card). Has its
// own opacity and collapses with maxHeight so it takes no space while the HUD is shown.
function createSideRow(left: PanelContent, right: PanelContent): HTMLElement {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.flexDirection = "row";
  row.style.alignItems = "stretch";
  row.style.gap = "clamp(14px, 3vw, 20px)";
  row.style.overflow = "hidden";
  // start collapsed (see createPanel)
  row.style.maxHeight = "0px";
  row.style.transition = "max-height 0.6s ease, opacity 0.5s ease";
  row.style.opacity = "0";

  const leftSection = createPanelSection("left", left);
  leftSection.style.flex = "1";
  row.appendChild(leftSection);

  const divider = document.createElement("div");
  divider.style.width = "1px";
  divider.style.alignSelf = "stretch";
  divider.style.background = GLASS_DIVIDER;
  row.appendChild(divider);

  const rightSection = createPanelSection("right", right);
  rightSection.style.flex = "1";
  row.appendChild(rightSection);

  return row;
}

// Narrow: one combined card — middle content OR the HUD on top, sideRow below. Each part
// has its own opacity; the card itself is shown when any of them is visible.
function createCombinedPanel(
  container: HTMLElement,
  middleContent: HTMLElement,
  statusContent: HTMLElement,
  solvedContent: HTMLElement,
  sideRow: HTMLElement,
  helpButton: HTMLElement,
  closeButton: HTMLElement,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.position = "absolute";
  // real value set by applyLayout (anchored below the hint pill)
  wrapper.style.top = "50%";
  wrapper.style.left = "50%";
  wrapper.style.transform = "translateX(-50%)";
  // wider than a single column, with some margin from the screen edge
  wrapper.style.width = "min(88vw, 460px)";
  wrapper.style.overflowY = "auto"; // maxHeight is set in applyLayout from the real remaining height
  wrapper.style.overscrollBehavior = "contain";
  wrapper.style.zIndex = "10";
  wrapper.style.pointerEvents = "none";
  wrapper.style.boxSizing = "border-box";
  wrapper.style.transition = FADE_TRANSITION;
  // start hidden (see createPanel)
  wrapper.style.opacity = "0";

  const card = createCardElement();
  // backdrop-filter + border-radius can leak blur at the corners on some mobile GPUs;
  // overflow:hidden forces a clean clip
  card.style.overflow = "hidden";
  // anchor for the corner button
  card.style.position = "relative";
  // more inner padding than the default card
  card.style.padding = "clamp(20px, 5vw, 28px)";
  card.style.fontSize = "clamp(12px, 2.8vw, 15px)";
  // spacing via middleContent's own marginBottom (animated with maxHeight), not flex gap
  card.style.gap = "0";

  // divider lives inside middleContent so it collapses together with it
  const topDivider = document.createElement("div");
  topDivider.style.height = "1px";
  topDivider.style.background = GLASS_DIVIDER;
  topDivider.style.marginTop = "clamp(20px, 5vw, 28px)"; // card gap is void while max-height is 0
  middleContent.appendChild(topDivider);

  card.append(middleContent, statusContent, solvedContent, sideRow);

  // "?" and "✕" share the corner and are mutually exclusive
  card.append(helpButton, closeButton);

  wrapper.appendChild(card);
  container.appendChild(wrapper);
  return wrapper;
}

// Gesture legend: right hand → cell, left hand → direction, middle → free rotation.
// Three panels on wide layouts, one combined panel on narrow ones.
export function createGestureGuide(
  container: HTMLElement,
  strings: GestureCubeStrings["gestureGuide"],
  onManualClose: () => void,
  onToggleHelp: () => void,
  // narrow layout anchors the combined panel below this element (the hint pill)
  hintPanel: HTMLElement,
  onRestart: () => void,
): GestureGuide {
  const leftContent: PanelContent = {
    title: strings.left.title,
    subtitle: strings.left.subtitle,
    description: strings.left.description,
    rows: buildRows(LEFT_HAND_ROW_META, strings.left.rowLabels),
    accentColor: GREEN,
  };
  const rightContent: PanelContent = {
    title: strings.right.title,
    subtitle: strings.right.subtitle,
    description: strings.right.description,
    rows: buildRows(RIGHT_HAND_ROW_META, strings.right.rowLabels),
    accentColor: BLUE,
  };

  const left = createPanel(container, "left", leftContent);
  const right = createPanel(container, "right", rightContent);

  // separate middle content for wide and narrow (one element cannot have two parents)
  const middleWide = createMiddleContent(strings.middle);
  const middleCombined = createMiddleContent(strings.middle);
  // narrow: collapse with maxHeight so a hidden panel takes no space; reveal slides up
  middleCombined.element.style.overflow = "hidden";
  middleCombined.element.style.maxHeight = "0px";
  middleCombined.element.style.marginBottom = "0px";
  middleCombined.element.style.opacity = "0";
  middleCombined.element.style.transform = "translateY(16px)";
  middleCombined.element.style.transition = "max-height 0.6s ease, margin-bottom 0.6s ease, opacity 0.5s ease, transform 0.5s ease";

  // same pattern for the HUD
  const statusWide = createHandStatusContent(strings.handStatus);
  const statusCombined = createHandStatusContent(strings.handStatus);
  statusWide.element.style.display = "none";
  statusCombined.element.style.overflow = "hidden";
  statusCombined.element.style.maxHeight = "0px";
  statusCombined.element.style.marginBottom = "0px";
  statusCombined.element.style.opacity = "0";
  statusCombined.element.style.transform = "translateY(16px)";
  statusCombined.element.style.transition = "max-height 0.6s ease, margin-bottom 0.6s ease, opacity 0.5s ease, transform 0.5s ease";

  // same pattern for the end-of-game content
  const solvedWide = createSolvedContent(strings.solved, onRestart);
  const solvedCombined = createSolvedContent(strings.solved, onRestart);
  solvedWide.element.style.display = "none";
  solvedCombined.element.style.overflow = "hidden";
  solvedCombined.element.style.maxHeight = "0px";
  solvedCombined.element.style.opacity = "0";
  solvedCombined.element.style.transform = "translateY(16px)";
  solvedCombined.element.style.transition = "max-height 0.6s ease, opacity 0.5s ease, transform 0.5s ease";

  // separate corner buttons per layout
  const helpButtonWide = createHelpButton(strings.toggleAriaLabel, onToggleHelp);
  const helpButtonCombined = createHelpButton(strings.toggleAriaLabel, onToggleHelp);
  const closeButtonWide = createCloseButton(strings.closeAriaLabel, onManualClose);
  const closeButtonCombined = createCloseButton(strings.closeAriaLabel, onManualClose);

  const middle = createMiddlePanel(container, middleWide.element, statusWide.element, solvedWide.element, helpButtonWide, closeButtonWide);

  // separate sections per layout
  const sideRowForCombined = createSideRow(leftContent, rightContent);
  const combined = createCombinedPanel(
    container,
    middleCombined.element,
    statusCombined.element,
    solvedCombined.element,
    sideRowForCombined,
    helpButtonCombined,
    closeButtonCombined,
  );

  // gap between the hint pill and the combined panel
  const COMBINED_PANEL_TOP_GAP = 16;
  const COMBINED_PANEL_BOTTOM_GAP = 12;
  // the pill starts visible; kept in sync via setHintPanelVisible
  let hintPanelVisible = true;

  // Minimum clearance between a side panel and the middle card in the wide layout.
  const WIDE_LAYOUT_MIN_GAP = 24;

  // Wide layout (side panels + middle card), sized from the container width: panels and
  // card take their preferred share of the width, then the side offset shrinks toward
  // the edges until everything clears. Returns false when even the minimum sizes do not
  // fit (or the side panels are taller than the box); the combined layout is used then.
  // Measured with the elements displayed; visibility is driven by opacity, no flash.
  function applyWideGeometry(): boolean {
    const W = container.clientWidth;
    const H = container.clientHeight;
    if (W < NARROW_LAYOUT_BREAKPOINT) return false;
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    let sideW = clamp(W * 0.24, SIDE_PANEL_MIN_PX, SIDE_PANEL_MAX_PX);
    let middleW = clamp(W * 0.36, MIDDLE_PANEL_MIN_PX, MIDDLE_PANEL_MAX_PX);
    // room left for one side panel + its offset
    let room = (W - middleW) / 2 - WIDE_LAYOUT_MIN_GAP;
    if (room < sideW + SIDE_OFFSET_MIN_PX) {
      sideW = SIDE_PANEL_MIN_PX;
      middleW = MIDDLE_PANEL_MIN_PX;
      room = (W - middleW) / 2 - WIDE_LAYOUT_MIN_GAP;
      if (room < sideW + SIDE_OFFSET_MIN_PX) return false;
    }
    const offset = clamp(Math.min(W * 0.17, room - sideW), SIDE_OFFSET_MIN_PX, SIDE_OFFSET_MAX_PX);
    // Everything inside the cards is em-based; deriving the root font from the container
    // width scales the whole guide with the box it lives in.
    middle.style.fontSize = `${clamp(W * 0.0115, 13, 17)}px`;
    const sideFont = `${clamp(W * 0.01, 12, 15)}px`;
    left.style.fontSize = sideFont;
    right.style.fontSize = sideFont;
    left.style.width = `${sideW}px`;
    right.style.width = `${sideW}px`;
    left.style.left = `${offset}px`;
    right.style.right = `${offset}px`;
    middle.style.width = `${middleW}px`;
    const previous = left.style.display;
    left.style.display = "block";
    const sideH = left.getBoundingClientRect().height;
    left.style.display = previous;
    return sideH <= H - 2 * COMBINED_PANEL_BOTTOM_GAP;
  }

  function applyLayout() {
    const narrow = !applyWideGeometry();
    left.style.display = narrow ? "none" : "block";
    right.style.display = narrow ? "none" : "block";
    middle.style.display = narrow ? "none" : "block";
    combined.style.display = narrow ? "block" : "none";
    if (!narrow) {
      // align the middle panel's top with the side panel. getBoundingClientRect includes
      // the translateY(-50%) transform; offsetTop does not. In short containers (an
      // embedding host's 16:9 box) the centered side panels start above the hint pill, so
      // never let the middle panel overlap it: keep it below the pill instead.
      const containerTop = container.getBoundingClientRect().top;
      const leftTop = left.getBoundingClientRect().top - containerTop;
      const pillBottom = (hintPanelVisible ? hintPanel.getBoundingClientRect().bottom : hintPanel.getBoundingClientRect().top) - containerTop;
      middle.style.top = `${Math.max(leftTop, pillBottom + COMBINED_PANEL_TOP_GAP)}px`;
    } else {
      // narrow: anchor below the hint pill, measured each time (its height varies)
      const containerTop = container.getBoundingClientRect().top;
      // when the pill is hidden, anchor to its top instead (fixed 80px) — see
      // setHintPanelVisible for why this is reported rather than read
      const anchor = hintPanelVisible ? hintPanel.getBoundingClientRect().bottom : hintPanel.getBoundingClientRect().top;
      const top = anchor - containerTop + COMBINED_PANEL_TOP_GAP;
      combined.style.top = `${top}px`;
      combined.style.transform = "translateX(-50%)";
      // never taller than the space left below the anchor; the card scrolls inside instead
      combined.style.maxHeight = `${Math.max(120, container.clientHeight - top - COMBINED_PANEL_BOTTOM_GAP)}px`;
    }
  }
  const observer = new ResizeObserver(applyLayout);
  observer.observe(container);
  // the pill can change height without resizing the container
  observer.observe(hintPanel);
  applyLayout(); // don't wait for the first async ResizeObserver tick

  // Narrow: the combined card stays visible while any of its parts is visible.
  let sideVisibleState = false;
  let middleVisibleState = false;
  let hudVisibleState = false;
  let solvedVisibleState = false;
  // "?" and "✕" are mutually exclusive
  let helpButtonRequestedState = false;

  // "✕" while the guide is open (auto or manual), "?" when closed and requested.
  function updateHelpButtonVisibility() {
    const guideOpen = sideVisibleState || middleVisibleState;
    helpButtonWide.style.display = !guideOpen && helpButtonRequestedState ? "flex" : "none";
    closeButtonWide.style.display = guideOpen ? "flex" : "none";
    helpButtonCombined.style.display = !guideOpen && helpButtonRequestedState ? "flex" : "none";
    closeButtonCombined.style.display = guideOpen ? "flex" : "none";
  }

  let guideWasOpen = false;
  let scrollHintTimer: number | null = null;
  function updateCombinedWrapperVisibility() {
    const visible = sideVisibleState || middleVisibleState || hudVisibleState || solvedVisibleState;
    combined.style.opacity = visible ? "1" : "0";
    // the wrapper must receive touches to scroll when the guide overflows; keep it
    // transparent to input while hidden
    combined.style.pointerEvents = visible ? "auto" : "none";
    // the HUD keeps the wrapper visible, so track the guide itself, not the wrapper
    const guideOpen = sideVisibleState || middleVisibleState;
    if (guideOpen && !guideWasOpen) scheduleScrollHint();
    guideWasOpen = guideOpen;
  }

  // When the guide overflows, nudge the content down and back once so the user sees
  // there is more below. Runs after the reveal transitions have settled.
  function scheduleScrollHint() {
    if (scrollHintTimer !== null) clearTimeout(scrollHintTimer);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    scrollHintTimer = window.setTimeout(() => {
      scrollHintTimer = null;
      if (combined.style.display === "none" || combined.scrollHeight - combined.clientHeight < 24) return;
      if (combined.scrollTop > 0) return; // the user already scrolled
      combined.scrollTo({ top: 48, behavior: "smooth" });
      window.setTimeout(() => {
        if (combined.scrollTop <= 48) combined.scrollTo({ top: 0, behavior: "smooth" });
      }, 450);
    }, 900);
  }

  // wide middle wrapper is visible if either content is; avoids a fade-out/in flicker
  // when the guide and the HUD swap in the same frame
  function updateMiddleWrapperVisibility() {
    middle.style.opacity = middleVisibleState || hudVisibleState || solvedVisibleState ? "1" : "0";
  }

  function setSideVisible(visible: boolean) {
    sideVisibleState = visible;
    const opacity = visible ? "1" : "0";
    left.style.opacity = opacity;
    right.style.opacity = opacity;
    sideRowForCombined.style.opacity = opacity;
    // narrow: also collapse so the HUD has no empty space below
    sideRowForCombined.style.maxHeight = visible ? "800px" : "0px";
    updateCombinedWrapperVisibility();
    // "✕" depends on sideVisibleState (same call in setMiddleVisible, harmless)
    updateHelpButtonVisibility();
  }

  function setMiddleVisible(visible: boolean) {
    middleVisibleState = visible;
    const opacity = visible ? "1" : "0";
    // wide: toggle display too — shares the wrapper with the HUD
    middleWide.element.style.display = visible ? "flex" : "none";
    // narrow: collapse + slide
    middleCombined.element.style.maxHeight = visible ? "320px" : "0px";
    middleCombined.element.style.marginBottom = visible ? "clamp(20px, 5vw, 28px)" : "0px";
    middleCombined.element.style.opacity = opacity;
    middleCombined.element.style.transform = visible ? "translateY(0)" : "translateY(16px)";
    updateCombinedWrapperVisibility();
    updateMiddleWrapperVisibility();
    updateHelpButtonVisibility();
  }

  // Same pattern for the HUD; app.ts keeps it mutually exclusive with setMiddleVisible.
  function setHandStatusVisible(visible: boolean) {
    hudVisibleState = visible;
    const opacity = visible ? "1" : "0";
    statusWide.element.style.display = visible ? "flex" : "none";
    statusCombined.element.style.maxHeight = visible ? "320px" : "0px";
    // no marginBottom here: nothing is visible below the HUD
    statusCombined.element.style.opacity = opacity;
    statusCombined.element.style.transform = visible ? "translateY(0)" : "translateY(16px)";
    updateCombinedWrapperVisibility();
    updateMiddleWrapperVisibility();
  }

  function updateHandStatus(status: HandStatusSnapshot) {
    statusWide.update(status);
    statusCombined.update(status);
  }

  function setSolvedVisible(visible: boolean) {
    solvedVisibleState = visible;
    solvedWide.element.style.display = visible ? "flex" : "none";
    solvedCombined.element.style.maxHeight = visible ? "400px" : "0px";
    solvedCombined.element.style.opacity = visible ? "1" : "0";
    solvedCombined.element.style.transform = visible ? "translateY(0)" : "translateY(16px)";
    updateCombinedWrapperVisibility();
    updateMiddleWrapperVisibility();
  }

  function updateSolved(stats: SolvedStats) {
    solvedWide.update(stats);
    solvedCombined.update(stats);
  }

  function setManualMode(active: boolean) {
    middleWide.setManual(active);
    middleCombined.setManual(active);
  }

  function setHelpButtonVisible(visible: boolean) {
    helpButtonRequestedState = visible;
    updateHelpButtonVisibility();
  }

  function setHintPanelVisible(visible: boolean) {
    hintPanelVisible = visible;
    applyLayout();
  }

  function remove() {
    observer.disconnect();
    if (scrollHintTimer !== null) clearTimeout(scrollHintTimer);
    left.remove();
    right.remove();
    middle.remove();
    combined.remove();
  }

  return { setSideVisible, setMiddleVisible, setManualMode, setHandStatusVisible, updateHandStatus, setSolvedVisible, updateSolved, setHelpButtonVisible, setHintPanelVisible, remove };
}
