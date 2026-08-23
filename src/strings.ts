// All user-facing text. UI modules never hardcode strings; the host passes this object.
export interface GestureCubeStrings {
  readonly cameraScreen: {
    readonly requesting: string;
    readonly denied: string;
  };
  // Shown on short landscape viewports (phones); tablets are tall enough and never see it.
  readonly orientationGate: {
    readonly title: string;
    readonly text: string;
  };
  readonly playScreen: {
    readonly startAriaLabel: string;
    readonly loadingModelMessage: string;
    readonly readyMessage: string;
  };
  readonly solverDisplay: {
    readonly hintLabel: string;
    readonly solvedLabel: string;
    readonly movesLabel: string;
    // "?" help panel: frame → square → arrow.
    readonly help: {
      readonly openAriaLabel: string;
      readonly closeAriaLabel: string;
      readonly title: string;
      readonly subtitle: string;
      readonly steps: readonly [HintHelpStep, HintHelpStep, HintHelpStep];
    };
  };
  readonly gestureGuide: {
    readonly left: GestureGuidePanelStrings;
    readonly right: GestureGuidePanelStrings;
    // title: auto-opened at game start. manualTitle: opened later via "?".
    readonly middle: { readonly title: string; readonly manualTitle: string; readonly description: string };
    readonly toggleAriaLabel: string;
    readonly closeAriaLabel: string;
    // End-of-game content shown in place of the HUD.
    readonly solved: {
      readonly title: string;
      readonly subtitle: string;
      readonly movesLabel: string;
      readonly timeLabel: string;
      readonly optimalLabel: string;
      readonly restartButton: string;
    };
    // Live hand-status HUD that replaces the middle guide panel during play.
    readonly handStatus: HandStatusStrings;
  };
}

export interface HintHelpStep {
  readonly label: string;
  readonly text: string;
}

export interface HandStatusStrings {
  readonly leftLabel: string;
  readonly rightLabel: string;
  readonly rotationLabel: string;
  // Raw finger state of either hand (shared by left and right).
  readonly handAbsent: string;
  readonly handFist: string;
  readonly handOneFinger: string;
  readonly handTwoFingers: string;
  readonly handThreeFingers: string;
  readonly handFourFingers: string;
  readonly handFullyOpen: string;
  // Interpreted rotation state (separate from the raw hand states above).
  readonly rotationLocked: string;
  readonly rotationReady: string;
  readonly rotationActiveLabel: string;
}

// rowLabels follow finger count 1→4 (same order as layer-swipe.ts / face-grid.ts).
export interface GestureGuidePanelStrings {
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly rowLabels: readonly [string, string, string, string];
}

export const TR_STRINGS: GestureCubeStrings = {
  cameraScreen: {
    requesting: "Kamera erişimi isteniyor…",
    denied: "Devam etmek için kamera izni gerekiyor. Tekrar denemek için dokun.",
  },
  orientationGate: {
    title: "Telefonu dikey çevir",
    text: "Bu deneyim telefonda dikey ekran için tasarlandı. Cihazını döndürdüğünde oyun kaldığı yerden devam eder.",
  },
  playScreen: {
    startAriaLabel: "Oyunu başlat",
    loadingModelMessage: "El tespit modeli hazırlanıyor, birkaç saniye sürebilir…",
    readyMessage: "Her şey hazır. Küpü karıştırmak için tekrar dokun.",
  },
  solverDisplay: {
    hintLabel: "İPUCU",
    solvedLabel: "ÇÖZÜLDÜ",
    movesLabel: "HAMLE",
    help: {
      openAriaLabel: "İpucu nasıl çalışır?",
      closeAriaLabel: "İpucu açıklamasını kapat",
      title: "İpucu",
      subtitle: "NASIL ÇALIŞIR?",
      steps: [
        { label: "YÜZEYİ BUL", text: "Küpü, çerçeveli yüz sana dönük olana kadar çevir." },
        { label: "KAREYİ SEÇ", text: "Halkayla işaretlenen kareyi sağ elinle seç." },
        { label: "OKU İZLE", text: "Katmanı okun gösterdiği yöne kaydır. Çift yönlü ok (⟷) yarım tur demek; hangi yöne çevirdiğin fark etmez." },
      ],
    },
  },
  gestureGuide: {
    left: {
      title: "SOL EL",
      subtitle: "DÖNDÜR",
      description: "Sol elinde gösterdiğin parmak sayısı küpün hangi yöne döneceğini belirler.",
      rowLabels: ["SAĞDAN SOLA", "SOLDAN SAĞA", "AŞAĞIDAN YUKARI", "YUKARIDAN AŞAĞI"],
    },
    right: {
      title: "SAĞ EL",
      subtitle: "KARE SEÇ",
      description: "Sağ elinde gösterdiğin parmak sayısı hangi kareyi seçeceğini belirler.",
      rowLabels: ["SOL ÜST", "SAĞ ÜST", "SOL ALT", "SAĞ ALT"],
    },
    middle: {
      title: "BAŞLAMAK İÇİN",
      manualTitle: "DÖNDÜRMEK İÇİN",
      description: "İki elini yumruk yap, ardından sağ elinle küpü dilediğin yöne çevir.",
    },
    toggleAriaLabel: "El hareketi rehberini aç veya kapat",
    closeAriaLabel: "Rehberi kapat",
    solved: {
      title: "TEBRİKLER",
      subtitle: "Küpü çözdün.",
      movesLabel: "HAMLE",
      timeLabel: "SÜRE",
      optimalLabel: "EN AZ",
      restartButton: "Yeniden Başlat",
    },
    handStatus: {
      leftLabel: "SOL EL",
      rightLabel: "SAĞ EL",
      rotationLabel: "DÖNDÜRME",
      handAbsent: "EL YOK",
      handFist: "YUMRUK",
      // The icon already shows the count.
      handOneFinger: "PARMAK",
      handTwoFingers: "PARMAK",
      handThreeFingers: "PARMAK",
      handFourFingers: "PARMAK",
      handFullyOpen: "AÇIK",
      rotationLocked: "KİLİTLİ",
      rotationReady: "HAZIR",
      rotationActiveLabel: "AKTİF",
    },
  },
};

export const EN_STRINGS: GestureCubeStrings = {
  cameraScreen: {
    requesting: "Requesting camera access…",
    denied: "Camera access is needed to continue. Tap to try again.",
  },
  orientationGate: {
    title: "Rotate your phone",
    text: "This experience is designed for portrait mode on phones. Turn your device upright and the game will pick up where you left off.",
  },
  playScreen: {
    startAriaLabel: "Start the game",
    loadingModelMessage: "Setting up hand tracking — this may take a few seconds…",
    readyMessage: "All set. Tap again to scramble the cube.",
  },
  solverDisplay: {
    hintLabel: "HINT",
    solvedLabel: "SOLVED",
    movesLabel: "MOVES",
    help: {
      openAriaLabel: "How do hints work?",
      closeAriaLabel: "Close hint guide",
      title: "Hints",
      subtitle: "HOW THEY WORK",
      steps: [
        { label: "FIND THE FACE", text: "Turn the cube until the outlined face is facing you." },
        { label: "PICK THE SQUARE", text: "Use your right hand to select the square marked with a ring." },
        { label: "FOLLOW THE ARROW", text: "Slide the layer in the direction of the arrow. A double-headed arrow (⟷) means a half turn — either direction works." },
      ],
    },
  },
  gestureGuide: {
    left: {
      title: "LEFT HAND",
      subtitle: "ROTATE",
      description: "The number of fingers you hold up on your left hand sets which way the cube turns.",
      rowLabels: ["RIGHT TO LEFT", "LEFT TO RIGHT", "BOTTOM TO TOP", "TOP TO BOTTOM"],
    },
    right: {
      title: "RIGHT HAND",
      subtitle: "SELECT",
      description: "The number of fingers you hold up on your right hand sets which square you select.",
      rowLabels: ["TOP LEFT", "TOP RIGHT", "BOTTOM LEFT", "BOTTOM RIGHT"],
    },
    middle: {
      title: "GETTING STARTED",
      manualTitle: "ROTATING THE CUBE",
      description: "Make a fist with both hands, then turn the cube any way you like with your right hand.",
    },
    toggleAriaLabel: "Show or hide the gesture guide",
    closeAriaLabel: "Close the guide",
    solved: {
      title: "WELL DONE",
      subtitle: "You solved the cube.",
      movesLabel: "MOVES",
      timeLabel: "TIME",
      optimalLabel: "OPTIMAL",
      restartButton: "Play Again",
    },
    handStatus: {
      leftLabel: "LEFT HAND",
      rightLabel: "RIGHT HAND",
      rotationLabel: "ROTATION",
      handAbsent: "NO HAND",
      handFist: "FIST",
      handOneFinger: "FINGER",
      handTwoFingers: "FINGERS",
      handThreeFingers: "FINGERS",
      handFourFingers: "FINGERS",
      handFullyOpen: "OPEN",
      rotationLocked: "LOCKED",
      rotationReady: "READY",
      rotationActiveLabel: "ACTIVE",
    },
  },
};

export type GestureCubeLocale = "tr" | "en";
export const STRINGS_BY_LOCALE: Readonly<Record<GestureCubeLocale, GestureCubeStrings>> = { tr: TR_STRINGS, en: EN_STRINGS };

// Standalone locale: ?lang= > browser language > tr.
export function resolveLocale(search: string, navigatorLanguage: string | undefined): GestureCubeLocale {
  const fromQuery = new URLSearchParams(search).get("lang");
  if (fromQuery === "tr" || fromQuery === "en") return fromQuery;
  return navigatorLanguage?.toLowerCase().startsWith("tr") ? "tr" : navigatorLanguage ? "en" : "tr";
}
