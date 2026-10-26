import type { TrackDef } from "./music";

/**
 * Original background music, one loop per place. Written for this project as
 * note data (see music.ts for the notation); no existing tune is quoted.
 */

/** Repeats a bar n times. */
const rep = (n: number, bar: string): string[] => Array<string>(n).fill(bar);

/** Eighth-note arpeggio up a triad and back: root, third, fifth, third, root, third, fifth, octave. */
const arp8 = (r: string, t: string, f: string, o: string): string => [r, t, f, t, r, t, f, o].join(" ");

/** Sixteenth-note arpeggio on a triad. */
const arp16 = (r: string, t: string, f: string, o: string): string => [r, t, f, t, r, t, f, t, r, t, f, t, r, t, f, o].join(" ");

/** Galloping sixteenths on a root and its octave. */
const gallop = (root: string, oct: string): string => [root, root, oct, root, root, root, oct, root, root, root, oct, root, root, oct, root, oct].join(" ");

const REST = ".";

/** Chords of the title tune, one per bar: bass, arpeggio and pad all follow the same progression. */
const TITLE_BASS: Record<string, string> = {
  Eb: "Eb2 Eb2 Eb3 Eb2 Bb2 Eb2 Eb3 Eb2",
  Cm: "C3 C3 C4 C3 G3 C3 C4 C3",
  Ab: "Ab2 Ab2 Ab3 Ab2 Eb3 Ab2 Ab3 Ab2",
  Bb: "Bb2 Bb2 Bb3 Bb2 F3 Bb2 Bb3 Bb2",
};
const TITLE_ARP: Record<string, string> = {
  Eb: arp16("Eb5", "G5", "Bb5", "Eb6"),
  Cm: arp16("C5", "Eb5", "G5", "C6"),
  Ab: arp16("C5", "Eb5", "Ab5", "C6"),
  Bb: arp16("D5", "F5", "Bb5", "D6"),
};
const TITLE_PAD: Record<string, string> = { Eb: "Eb3+G3+Bb3", Cm: "C3+Eb3+G3", Ab: "Ab3+C4+Eb4", Bb: "Bb3+D4+F4" };
const TITLE_PROGRESSION = ["Eb", "Cm", "Ab", "Bb", "Eb", "Cm", "Ab", "Bb", "Ab", "Bb", "Cm", "Eb", "Ab", "Bb", "Eb", "Bb"];

export const TRACKS = {
  /** Press Start: bright and eager, for the title screen. E-flat major, 128 bpm. */
  title: {
    bpm: 128,
    echo: { beats: 0.75, feedback: 0.3 },
    channels: [
      { inst: "bass", gate: 0.55, bars: TITLE_PROGRESSION.map((c) => TITLE_BASS[c]) },
      { inst: "pluck", vol: 0.85, echo: 0.4, bars: TITLE_PROGRESSION.map((c) => TITLE_ARP[c]) },
      { inst: "pad", gate: 0.98, bars: TITLE_PROGRESSION.map((c) => TITLE_PAD[c]) },
      {
        inst: "lead",
        echo: 0.2,
        bars: [
          "Bb5 - G5 - Bb5 - Eb6 -", "C6 - Bb5 - G5 - Eb5 -", "Ab5 - C6 - Eb6 - C6 -", "D6 - Bb5 - F5 - Bb5 D6",
          "G6 - Eb6 - Bb5 - Eb6 -", "Eb6 - C6 - G5 - C6 -", "C6 - Eb6 - Ab6 - Eb6 C6", "F6 - D6 - Bb5 - - -",
          "C6 - Eb6 - C6 - Ab5 -", "D6 - F6 - D6 - Bb5 -", "Eb6 - G6 - Eb6 - C6 -", "Bb5 - G5 - Bb5 - - -",
          "Ab5 - C6 - Eb6 - Ab6 -", "F6 - D6 - Bb5 - D6 F6", "G6 - Bb5 - Eb6 - Bb5 -", "D6 - - - F6 - - -",
        ],
      },
      { inst: "drums", vol: 0.85, bars: [...rep(16, "k+h h s+h h k+h k s+h h")] },
    ],
  },

  /** Neon Corridor: relaxed, a little shimmering. A minor, 96 bpm. */
  hallway: {
    bpm: 96,
    swing: 0.12,
    echo: { beats: 0.75, feedback: 0.38 },
    channels: [
      {
        inst: "pad",
        vol: 1,
        gate: 0.98,
        bars: [
          "A3+C4+E4", "F3+A3+C4", "C4+E4+G4", "G3+B3+D4",
          "A3+C4+E4", "F3+A3+C4", "C4+E4+G4", "G3+B3+D4",
          "A3+C4+E4", "F3+A3+C4", "C4+E4+G4", "G3+B3+D4",
          "A3+C4+E4", "F3+A3+C4", "G3+B3+D4", "E3+G#3+B3",
        ],
      },
      {
        inst: "bass",
        gate: 0.6,
        bars: [
          ...[0, 1, 2].flatMap(() => ["A2 . A3 . A2 . E3 .", "F2 . F3 . F2 . C3 .", "C3 . C4 . C3 . G3 .", "G2 . G3 . G2 . D3 ."]),
          "A2 . A3 . A2 . E3 .", "F2 . F3 . F2 . C3 .", "G2 . G3 . G2 . D3 .", "E2 . E3 . E2 . B2 .",
        ],
      },
      {
        inst: "pluck",
        echo: 0.55,
        bars: [
          arp8("A4", "C5", "E5", "A5"), arp8("F4", "A4", "C5", "F5"), arp8("C5", "E5", "G5", "C6"), arp8("G4", "B4", "D5", "G5"),
          arp8("A4", "C5", "E5", "A5"), arp8("F4", "A4", "C5", "F5"), arp8("C5", "E5", "G5", "C6"), arp8("G4", "B4", "D5", "G5"),
          arp8("A4", "C5", "E5", "A5"), arp8("F4", "A4", "C5", "F5"), arp8("C5", "E5", "G5", "C6"), arp8("G4", "B4", "D5", "G5"),
          arp8("A4", "C5", "E5", "A5"), arp8("F4", "A4", "C5", "F5"), arp8("G4", "B4", "D5", "G5"), arp8("E4", "G#4", "B4", "E5"),
        ],
      },
      {
        inst: "lead",
        vol: 0.9,
        echo: 0.3,
        bars: [
          ...rep(4, REST),
          "E5 - - C5 D5 - E5 -", "F5 - - E5 D5 - C5 -", "E5 - G5 - E5 - D5 C5", "D5 - - - B4 - - -",
          "A5 - G5 E5 - C5 E5 -", "A5 - G5 - F5 - E5 C5", "G5 - E5 - C5 - E5 G5", "A5 - G5 - E5 - D5 -",
          "E5 - - C5 D5 - E5 -", "F5 - - E5 D5 - C5 -", "D5 - G5 - B5 - A5 G5", "G#5 - B5 - E5 - - -",
        ],
      },
      {
        inst: "drums",
        vol: 0.8,
        bars: [...rep(4, "k+h . h . k+h . h ."), ...rep(12, "k+h h s+h h k+h h s+h h")],
      },
    ],
  },

  /** Slither: bouncy funk. E minor, 116 bpm. */
  snake: {
    bpm: 116,
    swing: 0.15,
    channels: [
      {
        inst: "bass",
        gate: 0.55,
        bars: [
          ...rep(2, "E2 . E3 E2 . E2 G2 B2"), "C3 . C4 C3 . C3 E3 G3", "D3 . D4 D3 . D3 F#3 A3",
          ...rep(2, "E2 . E3 E2 . E2 G2 B2"), "C3 . C4 C3 . C3 E3 G3", "D3 . D4 D3 . D3 F#3 A3",
          ...rep(2, "A2 . A3 A2 . A2 C3 E3"), ...rep(2, "C3 . C4 C3 . C3 E3 G3"),
          ...rep(2, "D3 . D4 D3 . D3 F#3 A3"), ...rep(2, "B2 . B3 B2 . B2 D#3 F#3"),
        ],
      },
      {
        inst: "stab",
        gate: 0.3,
        bars: [
          ...rep(2, ". E4+G4+B4 . . . E4+G4+B4 . E4+G4+B4"), ". E4+G4+C5 . . . E4+G4+C5 . E4+G4+C5", ". D4+F#4+A4 . . . D4+F#4+A4 . D4+F#4+A4",
          ...rep(2, ". E4+G4+B4 . . . E4+G4+B4 . E4+G4+B4"), ". E4+G4+C5 . . . E4+G4+C5 . E4+G4+C5", ". D4+F#4+A4 . . . D4+F#4+A4 . D4+F#4+A4",
          ...rep(2, ". E4+A4+C5 . . . E4+A4+C5 . E4+A4+C5"), ...rep(2, ". E4+G4+C5 . . . E4+G4+C5 . E4+G4+C5"),
          ...rep(2, ". D4+F#4+A4 . . . D4+F#4+A4 . D4+F#4+A4"), ...rep(2, ". D#4+F#4+B4 . . . D#4+F#4+B4 . D#4+F#4+B4"),
        ],
      },
      {
        inst: "lead",
        vol: 0.85,
        bars: [
          ...rep(4, REST),
          "B4 . E5 . G5 . F#5 E5", "D5 . E5 . B4 - - -", "C5 . E5 . G5 . E5 C5", "D5 . F#5 . A5 - F#5 D5",
          "A4 . C5 . E5 - D5 C5", "B4 . C5 . A4 - - -", "E5 . G5 . C6 - B5 G5", "A5 . G5 . E5 - - -",
          "F#5 . A5 . D6 - C#6 A5", "B5 . A5 . F#5 - - -", "D#5 . F#5 . B5 - A#5 F#5", "G#5 . F#5 . D#5 - - -",
        ],
      },
      {
        inst: "drums",
        vol: 0.8,
        bars: [...rep(16, "k+h . h . s+h . h . k+h . k+h . s+h . h h")],
      },
    ],
  },

  /** Brick Bash: bright and quick. C major, 138 bpm. */
  breakout: {
    bpm: 138,
    channels: [
      {
        inst: "bass",
        gate: 0.5,
        bars: [
          "C3 C4 C3 C4 C3 C4 C3 C4", "G2 G3 G2 G3 G2 G3 G2 G3", "A2 A3 A2 A3 A2 A3 A2 A3", "F2 F3 F2 F3 F2 F3 F2 F3",
          "C3 C4 C3 C4 C3 C4 C3 C4", "G2 G3 G2 G3 G2 G3 G2 G3", "A2 A3 A2 A3 A2 A3 A2 A3", "F2 F3 F2 F3 F2 F3 F2 F3",
          "F2 F3 F2 F3 F2 F3 F2 F3", "G2 G3 G2 G3 G2 G3 G2 G3", "E2 E3 E2 E3 E2 E3 E2 E3", "A2 A3 A2 A3 A2 A3 A2 A3",
          "F2 F3 F2 F3 F2 F3 F2 F3", "G2 G3 G2 G3 G2 G3 G2 G3", "C3 C4 C3 C4 C3 C4 C3 C4", "G2 G3 G2 G3 G2 G3 G2 G3",
        ],
      },
      {
        inst: "pluck",
        vol: 0.9,
        bars: [
          arp16("C5", "E5", "G5", "C6"), arp16("B4", "D5", "G5", "B5"), arp16("A4", "C5", "E5", "A5"), arp16("A4", "C5", "F5", "A5"),
          arp16("C5", "E5", "G5", "C6"), arp16("B4", "D5", "G5", "B5"), arp16("A4", "C5", "E5", "A5"), arp16("A4", "C5", "F5", "A5"),
          arp16("A4", "C5", "F5", "A5"), arp16("B4", "D5", "G5", "B5"), arp16("G4", "B4", "E5", "G5"), arp16("A4", "C5", "E5", "A5"),
          arp16("A4", "C5", "F5", "A5"), arp16("B4", "D5", "G5", "B5"), arp16("C5", "E5", "G5", "C6"), arp16("B4", "D5", "G5", "B5"),
        ],
      },
      {
        inst: "lead",
        bars: [
          "G5 - E5 - G5 - C6 -", "B5 - G5 - D5 - G5 -", "A5 - E5 - A5 - C6 -", "A5 - C6 - A5 - F5 -",
          "G5 - E5 - G5 - C6 -", "B5 - D6 - B5 - G5 -", "C6 - A5 - E5 - A5 -", "F5 - A5 - C6 - D6 E6",
          "C6 - A5 - F5 - A5 -", "D6 - B5 - G5 - B5 -", "B5 - G5 - E5 - G5 -", "C6 - B5 - A5 - E5 -",
          "A5 - C6 - F6 - E6 D6", "D6 - B5 - G5 - B5 D6", "E6 - C6 - G5 - E5 -", "D5 - G5 - B5 - D6 -",
        ],
      },
      {
        inst: "drums",
        vol: 0.85,
        bars: [...rep(16, "k+h h s+h h k+h h s+h k")],
      },
    ],
  },

  /** Hold the Line: driving and dark. D minor, 150 bpm. */
  defender: {
    bpm: 150,
    channels: [
      {
        inst: "bass",
        gate: 0.55,
        bars: [
          ...rep(2, gallop("D2", "D3")), gallop("Bb1", "Bb2"), gallop("C2", "C3"),
          ...rep(2, gallop("D2", "D3")), gallop("Bb1", "Bb2"), gallop("A1", "A2"),
          ...rep(2, gallop("G1", "G2")), ...rep(2, gallop("D2", "D3")),
          gallop("Bb1", "Bb2"), gallop("C2", "C3"), ...rep(2, gallop("A1", "A2")),
        ],
      },
      {
        inst: "pad",
        gate: 0.98,
        bars: [
          "D4+F4+A4", "D4+F4+A4", "Bb3+D4+F4", "C4+E4+G4",
          "D4+F4+A4", "D4+F4+A4", "Bb3+D4+F4", "A3+C#4+E4",
          "G3+Bb3+D4", "G3+Bb3+D4", "D4+F4+A4", "D4+F4+A4",
          "Bb3+D4+F4", "C4+E4+G4", "A3+C#4+E4", "A3+C#4+E4",
        ],
      },
      {
        inst: "lead",
        vol: 0.9,
        echo: 0.25,
        bars: [
          "D5 . F5 . A5 - G5 F5", "E5 - D5 - A4 - - -", "Bb4 . D5 . F5 - E5 D5", "C5 - E5 - G5 - - -",
          "D5 . F5 . A5 - C6 A5", "D6 - C6 - A5 - - -", "Bb5 - A5 - F5 - D5 -", "C#5 - E5 - A5 - G5 E5",
          "G5 - Bb5 - D6 - C6 Bb5", "A5 - G5 - D5 - - -", "F5 - A5 - D6 - C6 A5", "F5 - E5 - D5 - - -",
          "D6 - Bb5 - F5 - Bb5 D6", "E6 - C6 - G5 - C6 E6", "C#6 - A5 - E5 - A5 C#6", "E6 - - - C#6 - - -",
        ],
      },
      {
        inst: "drums",
        vol: 0.9,
        bars: [...rep(16, "k+h . h . s+h . h . k+h . h k s+h . h .")],
      },
    ],
  },

  /** Drift: slow and spacious. D minor, 88 bpm. */
  meteor: {
    bpm: 88,
    echo: { beats: 1.5, feedback: 0.5 },
    channels: [
      {
        inst: "pad",
        vol: 1.1,
        gate: 0.99,
        bars: [
          ...rep(2, "D3+F3+A3+C4"), ...rep(2, "Bb2+D3+F3+A3"), ...rep(2, "G2+Bb2+D3+F3"), ...rep(2, "A2+C#3+E3+G3"),
          ...rep(2, "D3+F3+A3+C4"), ...rep(2, "Bb2+D3+F3+A3"), ...rep(2, "F3+A3+C4+E4"), ...rep(2, "A2+C#3+E3+G3"),
        ],
      },
      {
        inst: "bass",
        vol: 0.8,
        gate: 0.8,
        bars: [
          ...rep(2, "D2 - - - - - D2 -"), ...rep(2, "Bb1 - - - - - Bb1 -"), ...rep(2, "G1 - - - - - G1 -"), ...rep(2, "A1 - - - - - A1 -"),
          ...rep(2, "D2 - - - - - D2 -"), ...rep(2, "Bb1 - - - - - Bb1 -"), ...rep(2, "F2 - - - - - F2 -"), ...rep(2, "A1 - - - - - A1 -"),
        ],
      },
      {
        inst: "bell",
        echo: 0.6,
        bars: [
          "A5 . . D6", "C6 . A5 .", "D6 . . F6", "D6 . Bb5 .", "Bb5 . . D6", "C6 . G5 .", "C#6 . . E6", "A5 . . .",
          "F6 . E6 D6", "A5 . . .", "F5 . A5 Bb5", "D6 . . .", "A5 . C6 F6", "E6 . C6 .", "C#6 . E6 .", "G6 . E6 C#6",
        ],
      },
      {
        inst: "pluck",
        vol: 0.55,
        echo: 0.7,
        bars: [
          arp8("D4", "F4", "A4", "D5"), arp8("D4", "F4", "A4", "C5"), arp8("Bb3", "D4", "F4", "Bb4"), arp8("Bb3", "D4", "F4", "A4"),
          arp8("G3", "Bb3", "D4", "G4"), arp8("G3", "Bb3", "D4", "F4"), arp8("A3", "C#4", "E4", "A4"), arp8("A3", "C#4", "E4", "G4"),
          arp8("D4", "F4", "A4", "D5"), arp8("D4", "F4", "A4", "C5"), arp8("Bb3", "D4", "F4", "Bb4"), arp8("Bb3", "D4", "F4", "A4"),
          arp8("F4", "A4", "C5", "F5"), arp8("F4", "A4", "C5", "E5"), arp8("A3", "C#4", "E4", "A4"), arp8("A3", "C#4", "E4", "G4"),
        ],
      },
      {
        inst: "drums",
        vol: 0.55,
        bars: [...rep(16, "k . . . . . . . k . . . . . h .")],
      },
    ],
  },

  /** Chomp Chase: mischievous and bouncy. A minor, 132 bpm. */
  maze: {
    bpm: 132,
    swing: 0.1,
    channels: [
      {
        inst: "bass",
        gate: 0.7,
        bars: [
          ...rep(2, "A2 C3 E3 C3"), "D3 F3 A3 F3", "E3 G#3 B3 G#3",
          ...rep(2, "A2 C3 E3 C3"), "D3 F3 A3 F3", "E3 G#3 B3 G#3",
          "F2 A2 C3 A2", "G2 B2 D3 B2", ...rep(2, "A2 C3 E3 C3"),
          "D3 F3 A3 F3", "E3 G#3 B3 G#3", "A2 C3 E3 C3", "E3 G#3 B3 G#3",
        ],
      },
      {
        inst: "stab",
        gate: 0.3,
        bars: [
          ...rep(2, ". E4+A4+C5 . E4+A4+C5 . E4+A4+C5 . E4+A4+C5"), ". F4+A4+D5 . F4+A4+D5 . F4+A4+D5 . F4+A4+D5", ". E4+G#4+B4 . E4+G#4+B4 . E4+G#4+B4 . E4+G#4+B4",
          ...rep(2, ". E4+A4+C5 . E4+A4+C5 . E4+A4+C5 . E4+A4+C5"), ". F4+A4+D5 . F4+A4+D5 . F4+A4+D5 . F4+A4+D5", ". E4+G#4+B4 . E4+G#4+B4 . E4+G#4+B4 . E4+G#4+B4",
          ". F4+A4+C5 . F4+A4+C5 . F4+A4+C5 . F4+A4+C5", ". G4+B4+D5 . G4+B4+D5 . G4+B4+D5 . G4+B4+D5", ...rep(2, ". E4+A4+C5 . E4+A4+C5 . E4+A4+C5 . E4+A4+C5"),
          ". F4+A4+D5 . F4+A4+D5 . F4+A4+D5 . F4+A4+D5", ". E4+G#4+B4 . E4+G#4+B4 . E4+G#4+B4 . E4+G#4+B4", ". E4+A4+C5 . E4+A4+C5 . E4+A4+C5 . E4+A4+C5", ". E4+G#4+B4 . E4+G#4+B4 . E4+G#4+B4 . E4+G#4+B4",
        ],
      },
      {
        inst: "thin",
        bars: [
          "A5 - E5 - A5 - C6 B5", "A5 - G#5 - A5 - E5 -", "D6 - A5 - D6 - F6 E6", "D6 - B5 - G#5 - B5 -",
          "A5 - E5 - A5 - C6 B5", "A5 - G#5 - G5 - E5 -", "F6 - D6 - A5 - D6 -", "E6 - D6 - B5 - G#5 -",
          "A5 - C6 - F6 - E6 C6", "B5 - D6 - G6 - F6 D6", "C6 - E6 - A6 - G6 E6", "A5 - - - E5 - - -",
          "D6 - F6 - A6 - F6 D6", "E6 - G#5 - B5 - E6 -", "C6 - A5 - E5 - A5 -", "B5 - G#5 - E5 - G#5 B5",
        ],
      },
      {
        inst: "drums",
        vol: 0.8,
        bars: [...rep(16, "k+h h s+h h k+h h s+h h")],
      },
    ],
  },
} satisfies Record<string, TrackDef>;

export type MusicName = keyof typeof TRACKS;
