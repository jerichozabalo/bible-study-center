/**
 * The CCF GLC curriculum, transcribed from `~/glc-books/GLC-SESSIONS.md`
 * (captured 2026-08-19 from https://glc.ccf.org.ph). 8 books, 50 sessions:
 * GLC 1 is Books 1-4 (20 sessions), GLC 2 is Books 5-8 (30 sessions) — #33.
 *
 * These are CCF's published titles and are quoted, not relabelled. That is why
 * "DGroup 101" and "Roles of a DGroup Leader" survive here while the app itself
 * says BGroup everywhere it speaks for itself (#66).
 *
 * ⛔ Never re-derive this from the artboards. Their mock data invents "Book 3 —
 * Christian Beliefs"; the real Book 3 is The Holy Spirit, four sessions.
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
          "One Source — The Holy Spirit",
          "One Pursuit — Growing in Our Relationship with Christ",
        ],
      },
      {
        number: 2,
        title: "Spiritual Disciplines",
        sessions: [
          "One Connection — Prayer",
          "One Basis — The Bible",
          "One Family — The Church",
          "One Step — Baptism",
          "One Focus — Worship",
          "One Task — Witnessing",
        ],
      },
      {
        number: 3,
        title: "The Holy Spirit",
        sessions: [
          "Who Is the Holy Spirit?",
          "The Works of the Holy Spirit",
          "The Gifts and the Fruits of the Holy Spirit",
          "Walking in the Spirit",
        ],
      },
      {
        number: 4,
        title: "CCF DNA",
        sessions: ["Mission & Vision", "CCF Strategy", "Core Values (Part 1)", "Core Values (Part 2)"],
      },
    ],
  },
  {
    name: "GLC 2",
    position: 2,
    books: [
      {
        number: 5,
        title: "Starting Point for Small Groups / DGroup 101",
        sessions: [
          "Biblical Foundations of Small Group Ministry",
          "Life-on-Life Discipleship — Roles of a DGroup Leader",
          "The Process of Discipleship",
          "Handling Issues in DGroups",
        ],
      },
      {
        number: 6,
        title: "Basic Doctrines",
        sessions: [
          "God's Word, The Bible",
          "God's Person and Nature",
          "Jesus — His Person and Works",
          "Salvation",
          "The Trinity",
          "Marriage / Gender",
        ],
      },
      {
        number: 7,
        title: "Family Life",
        sessions: [
          "God's Design for the Family",
          "Roles of Husband & Wife",
          "Roles of Children and Single Adults",
          "Communication & Restoring Relationship",
          "Roles of Parents",
          "How to Influence Your Children",
          "What to Teach Your Children (Part 1)",
          "What to Teach Your Children (Part 2)",
        ],
      },
      {
        number: 8,
        title: "Bible Survey",
        sessions: [
          "The Importance of the Bible Survey",
          "The Pentateuch",
          "Historical Books 1: The Rise to the Monarchy",
          "Historical Books 2: The Fall of the Monarchy",
          "Wisdom Literature & Poetry",
          "Major Prophets",
          "Minor Prophets",
          "The New Testament Gospels",
          "The Acts of the Apostles",
          "The Pauline Epistles",
          "The General Epistles",
          "Revelation",
        ],
      },
    ],
  },
];
