/**
 * The CCF GLC curriculum, transcribed from the 2025–26 editions — the PDFs in
 * `~/glc-books/glc-latest-2026-10-05` (downloaded 2026-10-05 from
 * https://glc.ccf.org.ph; titles quoted from each book's own contents page).
 * 8 books, 41 sessions: GLC 1 is Books 1-4 (15 sessions), GLC 2 is Books 5-8
 * (26 sessions) — #33 as amended by #77.
 *
 * #77 — an edition update retitles the slots that survive (a session number is
 * an identity: the row and every completion on it stay put) and tombstones the
 * sessions a new printing removed (`migrations/012`, never a delete). The
 * lists below are each book's LIVE sessions, in published order; the seed
 * itself only ever inserts and updates.
 *
 * These are CCF's published titles and are quoted, not relabelled. That is why
 * "DGroup 101" and "Roles of a Dgroup Leader" survive here while the app itself
 * says BGroup everywhere it speaks for itself (#66).
 *
 * ⛔ Never re-derive this from the artboards. Their mock data invents "Book 3 —
 * Christian Beliefs" and draws Book 1 with sessions the 5th edition dropped;
 * the real Book 3 is The Holy Spirit, three sessions.
 *
 * A book's number is stored separately from its title, so a screen renders
 * "Book 3 — The Holy Spirit" and a custom book (#22, issue 13) can have no
 * number at all without its title reading strangely.
 */

export type SeedBook = {
  /** The published book number, unique across both programs. */
  number: number;
  title: string;
  /** Session titles in published order; the index + 1 is the session number. */
  sessions: string[];
};

export type SeedProgram = {
  name: string;
  position: number;
  books: SeedBook[];
};

export const GLC_PROGRAMS: SeedProgram[] = [
  {
    name: "GLC 1",
    position: 1,
    books: [
      {
        number: 1,
        title: "One By One",
        sessions: [
          "One Truth — The Gospel",
          "One Way — The Savior",
          "One Proof — Our New Life in Christ",
          "One Promise — The Assurance of Salvation",
          "One Pursuit — Living Victoriously in Christ",
        ],
      },
      {
        number: 2,
        title: "Spiritual Disciplines",
        sessions: [
          "One Connection — Prayer and Fasting",
          "One Basis — The Bible",
          "One Family — The Church",
          "One Blessing — Generous Giving",
          "One Task — Witnessing",
        ],
      },
      {
        number: 3,
        title: "The Holy Spirit",
        sessions: [
          "The Person And Works of the Holy Spirit",
          "The Gifts of the Holy Spirit",
          "Walking in the Spirit",
        ],
      },
      {
        number: 4,
        title: "CCF DNA",
        sessions: ["Mission, Vision, Strategy", "Core Values"],
      },
    ],
  },
  {
    name: "GLC 2",
    position: 2,
    books: [
      {
        number: 5,
        title: "DGroup 101",
        sessions: [
          "Biblical Foundations for DGroup Ministry",
          "Readiness and Roles of a Dgroup Leader",
          "How to Start and Facilitate a Dgroup Meeting",
        ],
      },
      {
        number: 6,
        title: "Basic Doctrines",
        sessions: [
          "God's Word, The Bible",
          "God's Nature and Person",
          "Jesus: His Person and Works",
          "Salvation",
          "The Trinity",
          "Marriage and Gender",
        ],
      },
      {
        number: 7,
        title: "Family Life",
        sessions: [
          "God's Design for the Family",
          "How to Influence Your Children",
          "Communicate to Connect",
          "What to Teach Your Children",
          "Roles of the Youth and Singles",
        ],
      },
      {
        number: 8,
        title: "Bible Survey",
        sessions: [
          "The Importance of Bible Survey",
          "The Pentateuch",
          "Historical Books 1: The Rise to Monarchy",
          "Historical Books 2: The Fall of The Monarchy",
          "Wisdom Literature and Poetry",
          "Major Prophets",
          "Minor Prophets",
          "The New Testament Gospels",
          "The Acts of The Apostles",
          "The Pauline Epistles",
          "General Epistles",
          "Revelation",
        ],
      },
    ],
  },
];
