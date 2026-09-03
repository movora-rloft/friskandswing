/* Frisk & Swing — schedule source-of-truth
   Curated from friskandswing.com/schedule.
   Edit here when classes change; the site renders from this object.
   Levels: beg (beginner), imp (improver), int (intermediate), adv (advanced), all (open/all-levels)
   Rooms: 1 Studio 1, 2 Studio 2, 3 Studio 3
*/

const SCHEDULE = [
  {
    day: "Monday",
    items: [
      { time: "8:00–9:00 PM", style: "salsa",   name: "Salsa On-2 — Open Level",          level: "all", room: 1, instructors: "Fai & Mavis" },
      { time: "9:00–10:00 PM",style: "salsa",   name: "Salsa On-2 — Bailamos Training",    level: "adv", room: 1, instructors: "Fai & Mavis" },
      { time: "8:00–9:00 PM", style: "bachata", name: "Bachata Tech — Open",               level: "imp", room: 3, instructors: "Harry A. & Adela" }
    ]
  },
  {
    day: "Tuesday",
    items: [
      { time: "8:00–9:00 PM", style: "bachata", name: "Bachata Improver 1",                level: "imp", room: 1, instructors: "Harry A. & Adela" },
      { time: "9:15–10:15 PM",style: "bachata", name: "Bachata Foundation 1",              level: "beg", room: 1, instructors: "TBA" }
    ]
  },
  {
    day: "Wednesday",
    items: [
      { time: "8:00–9:00 PM", style: "zouk",    name: "Zouk Intermediate",                 level: "int", room: 2, instructors: "Lawrence & Rachel" },
      { time: "9:00–10:00 PM",style: "zouk",    name: "Zouk Beginner (New Intake)",        level: "beg", room: 2, instructors: "Lawrence & Vivien" },
      { time: "8:00–9:00 PM", style: "salsa",   name: "Salsa On-2 — Beginner",             level: "beg", room: 1, instructors: "Fai & Sabrine" },
      { time: "9:00–10:00 PM",style: "salsa",   name: "Salsa On-2 — Adv Beginner",         level: "adv", room: 1, instructors: "Fai & Sabrine" },
      { time: "8:00–9:00 PM", style: "bachata", name: "Bachata Fusion — Level Up (Collab)",level: "imp", room: 3, instructors: "Khalil & Mavis" },
      { time: "9:00–10:00 PM",style: "bachata", name: "Bachata Fusion — Fundamentals (Collab)", level: "beg", room: 3, instructors: "Khalil & Mavis" }
    ]
  },
  {
    day: "Thursday",
    items: [
      { time: "8:00–9:00 PM", style: "zouk",    name: "Zouk Improver",                     level: "imp", room: 1, instructors: "Jade & Rachel" },
      { time: "8:00–9:00 PM", style: "zouk",    name: "Zouk Improver",                     level: "imp", room: 3, instructors: "Lawrence & Rachel" },
      { time: "9:00–11:00 PM",style: "zouk",    name: "Zouk Practica",                     level: "all", room: 1, instructors: "All welcome" }
    ]
  },
  {
    day: "Friday",
    items: [
      { time: "8:30–9:30 PM", style: "bachata", name: "Bachata Intermediate 2",            level: "int", room: 1, instructors: "Qiqi (Asst. Michael)" }
    ]
  },
  {
    day: "Sat / Sun",
    items: [
      { time: "6:00–8:00 PM", style: "salsa",   name: "Salsa Son — Performance Team (Collab)", level: "adv", room: 1, instructors: "Zam" }
    ]
  }
];

const LEVEL_LABEL = {
  beg: "Beginner",
  imp: "Improver",
  int: "Intermediate",
  adv: "Advanced",
  all: "All levels"
};
