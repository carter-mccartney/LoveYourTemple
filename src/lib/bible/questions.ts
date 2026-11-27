// Bible Challenge questions. Hand-written cards (checked against the text; references given)
// plus generators that build endless questions from the Bible itself — no AI, no cost.
import { BOOKS, SECTIONS, book, sectionOf, type Book } from "./canon";
import { loadBook } from "./text";
import type { CustomCard } from "../types";
import { TEACHER_CARDS } from "./teachers";

export type Category = "people" | "events" | "places" | "numbers" | "truefalse" | "inbible" | "whosaid" | "teachers" | "books" | "verses" | "mine";

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "people", label: "People" },
  { id: "events", label: "Events" },
  { id: "places", label: "Places" },
  { id: "numbers", label: "Numbers" },
  { id: "truefalse", label: "True or false" },
  { id: "inbible", label: "Is it in the Bible?" },
  { id: "whosaid", label: "Who said it?" },
  { id: "teachers", label: "Pastors & authors" },
  { id: "books", label: "Books" },
  { id: "verses", label: "Verses" },
  { id: "mine", label: "My cards" },
];

export interface QCard {
  id: string;
  cat: Category;
  prompt: string;
  /** A quoted verse or saying shown under the prompt. */
  quote?: string;
  kind: "text" | "tf" | "mc";
  /** Accepted answers (first is shown). For tf: "True" or "False". */
  answers: string[];
  choices?: string[];
  ref?: string;
  explain?: string;
  /** Where to read or watch the original. */
  link?: string;
}

// ---------- Hand-written cards ----------
// Short answers: [question, "answer|alternate|…", reference, explanation?]
type T = [string, string, string, string?];

const PEOPLE: T[] = [
  ["Who built the ark?", "Noah", "Genesis 6:14"],
  ["Who was the first man?", "Adam", "Genesis 2:7"],
  ["Who was the first murder victim?", "Abel", "Genesis 4:8"],
  ["Who lived 969 years, the longest life recorded in the Bible?", "Methuselah", "Genesis 5:27"],
  ["Who was Abraham's wife?", "Sarah|Sarai", "Genesis 17:15"],
  ["What was the name of Abraham and Sarah's son of promise?", "Isaac", "Genesis 21:3"],
  ["Who was Abraham's son by Hagar?", "Ishmael", "Genesis 16:15"],
  ["Who was Abraham's nephew who lived in Sodom?", "Lot", "Genesis 14:12"],
  ["Who was Jacob's twin brother?", "Esau", "Genesis 25:25–26"],
  ["What new name did God give Jacob?", "Israel", "Genesis 32:28"],
  ["Which wife did Jacob work seven years for, and love most?", "Rachel", "Genesis 29:18"],
  ["Who was Jacob's first wife, given by Laban's trick?", "Leah", "Genesis 29:23–25"],
  ["Which son of Jacob was given a coat of many colors?", "Joseph", "Genesis 37:3"],
  ["Who was Moses' brother and Israel's first high priest?", "Aaron", "Exodus 28:1"],
  ["Who was Moses' sister, who led the women in song after the Red Sea?", "Miriam", "Exodus 15:20"],
  ["Who led Israel into the Promised Land after Moses died?", "Joshua", "Joshua 1:1–2"],
  ["Besides Joshua, which of the twelve spies gave a good report?", "Caleb", "Numbers 14:6–9"],
  ["Who hid the Israelite spies in Jericho?", "Rahab", "Joshua 2:1–4"],
  ["Which judge of Israel was a woman and a prophetess?", "Deborah", "Judges 4:4"],
  ["Which judge asked God for a sign with a fleece?", "Gideon", "Judges 6:36–40"],
  ["Which judge killed a lion with his bare hands?", "Samson", "Judges 14:5–6"],
  ["Who betrayed Samson to the Philistines?", "Delilah", "Judges 16:18"],
  ["Who was Ruth's mother-in-law?", "Naomi", "Ruth 1:4"],
  ["Whom did Ruth marry?", "Boaz", "Ruth 4:13"],
  ["Who prayed for a son at Shiloh and gave him to the Lord?", "Hannah", "1 Samuel 1:20–28"],
  ["Which prophet anointed both Saul and David?", "Samuel", "1 Samuel 10:1; 16:13"],
  ["Who was the first king of Israel?", "Saul", "1 Samuel 10:1"],
  ["Who killed Goliath?", "David", "1 Samuel 17:50"],
  ["Which son of Saul was David's closest friend?", "Jonathan", "1 Samuel 18:1"],
  ["Which prophet confronted David about Bathsheba?", "Nathan", "2 Samuel 12:7"],
  ["Which king asked God for wisdom?", "Solomon", "1 Kings 3:9"],
  ["Which prophet was fed by ravens?", "Elijah", "1 Kings 17:6"],
  ["Who was the wicked queen married to King Ahab?", "Jezebel", "1 Kings 16:31"],
  ["Who succeeded Elijah and received a double portion of his spirit?", "Elisha", "2 Kings 2:9–15"],
  ["Which Syrian army commander was healed of leprosy in the Jordan?", "Naaman", "2 Kings 5:14"],
  ["Who led the rebuilding of Jerusalem's walls?", "Nehemiah", "Nehemiah 2:17"],
  ["Who became queen of Persia and saved the Jews?", "Esther", "Esther 2:17"],
  ["Who was Esther's cousin who raised her?", "Mordecai", "Esther 2:7"],
  ["Which king of Babylon saw a vision of a great statue?", "Nebuchadnezzar", "Daniel 2:31"],
  ["Which king saw the handwriting on the wall?", "Belshazzar", "Daniel 5:5"],
  ["Who was thrown into the lions' den?", "Daniel", "Daniel 6:16"],
  ["Which prophet was swallowed by a great fish?", "Jonah", "Jonah 1:17"],
  ["Which prophet was told to marry Gomer?", "Hosea", "Hosea 1:3"],
  ["Which angel announced Jesus' birth to Mary?", "Gabriel", "Luke 1:26–27"],
  ["Who was the father of John the Baptist?", "Zechariah|Zacharias", "Luke 1:13"],
  ["Who was king of Judea when Jesus was born?", "Herod", "Matthew 2:1"],
  ["Who baptized Jesus?", "John the Baptist|John", "Matthew 3:13"],
  ["Which Pharisee came to Jesus by night?", "Nicodemus", "John 3:1–2"],
  ["Which short tax collector climbed a sycamore tree to see Jesus?", "Zacchaeus", "Luke 19:2–4"],
  ["Whom did Jesus raise after he had been dead four days?", "Lazarus", "John 11:39–44"],
  ["Who were Lazarus' two sisters?", "Mary and Martha|Martha and Mary", "John 11:1"],
  ["Which synagogue ruler's daughter did Jesus raise?", "Jairus", "Mark 5:22, 41–42"],
  ["Which blind beggar near Jericho received his sight?", "Bartimaeus", "Mark 10:46–52"],
  ["Which disciple denied Jesus three times?", "Peter|Simon Peter", "Luke 22:61"],
  ["Which disciple betrayed Jesus?", "Judas Iscariot|Judas", "Matthew 26:14–16"],
  ["Which disciple doubted until he saw Jesus' wounds?", "Thomas", "John 20:24–28"],
  ["Which tax collector became an apostle and is also called Levi?", "Matthew", "Matthew 9:9; Mark 2:14"],
  ["Who was the high priest at Jesus' trial?", "Caiaphas", "Matthew 26:57"],
  ["Which Roman governor sentenced Jesus?", "Pontius Pilate|Pilate", "Matthew 27:24–26"],
  ["Which prisoner was released instead of Jesus?", "Barabbas", "Matthew 27:26"],
  ["Who was made to carry Jesus' cross?", "Simon of Cyrene|Simon", "Mark 15:21"],
  ["Who asked Pilate for Jesus' body and laid it in his own tomb?", "Joseph of Arimathea|Joseph", "Matthew 27:57–60"],
  ["In John's Gospel, who first saw the risen Jesus?", "Mary Magdalene", "John 20:14–16"],
  ["Who was chosen to replace Judas among the Twelve?", "Matthias", "Acts 1:26"],
  ["Who was the first Christian martyr?", "Stephen", "Acts 7:59–60"],
  ["What was Paul's name before he was called Paul?", "Saul", "Acts 13:9"],
  ["Who traveled with Paul on his first missionary journey?", "Barnabas", "Acts 13:2"],
  ["Which husband and wife lied about their gift and died?", "Ananias and Sapphira|Sapphira and Ananias", "Acts 5:1–10"],
  ["Which seller of purple cloth became the first convert in Philippi?", "Lydia", "Acts 16:14"],
  ["Which young man fell from a window during Paul's long sermon?", "Eutychus", "Acts 20:9"],
  ["Who was the runaway slave Paul sent back to Philemon?", "Onesimus", "Philemon 10–12"],
  ["Who was Timothy's grandmother, praised for her faith?", "Lois", "2 Timothy 1:5"],
  ["Which Gospel writer was a doctor?", "Luke", "Colossians 4:14"],
];

const EVENTS: T[] = [
  ["What did Esau sell his birthright for?", "Stew|Pottage|Red stew|Lentil stew", "Genesis 25:29–34"],
  ["What did Jacob see in his dream at Bethel?", "A ladder|Ladder|Stairway|A stairway", "Genesis 28:12"],
  ["What did Lot's wife become when she looked back?", "A pillar of salt|Pillar of salt|Salt", "Genesis 19:26"],
  ["What food did God send from heaven in the wilderness?", "Manna", "Exodus 16:15"],
  ["What idol did Aaron make while Moses was on the mountain?", "A golden calf|Golden calf|Calf", "Exodus 32:4"],
  ["What animal spoke to Balaam?", "A donkey|Donkey|Ass", "Numbers 22:28"],
  ["What was Jesus' first miracle in John's Gospel?", "Water into wine|Turning water into wine", "John 2:11"],
  ["What did Jesus ride into Jerusalem?", "A donkey|Donkey|Colt|Ass", "Matthew 21:7"],
  ["What prayer did Jesus teach that begins “Our Father”?", "The Lord's Prayer|Lord's Prayer|Our Father", "Matthew 6:9–13"],
  ["What is Jesus' sermon in Matthew 5–7 usually called?", "The Sermon on the Mount|Sermon on the Mount", "Matthew 5:1"],
  ["What happened to the disciples on the day of Pentecost?", "They were filled with the Holy Spirit|Filled with the Holy Spirit|Holy Spirit came", "Acts 2:4"],
  ["On what road was Saul (Paul) converted?", "The road to Damascus|Damascus", "Acts 9:3"],
  ["Where did God confuse the language of the whole earth?", "Babel|The Tower of Babel|Tower of Babel", "Genesis 11:9"],
  ["What sign did God give Noah after the flood?", "A rainbow|Rainbow|Bow", "Genesis 9:13"],
  ["What did Gideon's men carry when they surprised the Midianites?", "Trumpets and jars with torches|Trumpets|Torches", "Judges 7:16"],
  ["What did David use to kill Goliath?", "A sling and a stone|Sling|Stone|Sling and stone", "1 Samuel 17:49"],
  ["How did Elijah leave the earth?", "In a whirlwind|Whirlwind|Chariot of fire", "2 Kings 2:11"],
  ["What were the gifts of the wise men?", "Gold, frankincense and myrrh|Gold frankincense myrrh", "Matthew 2:11"],
  ["What was the sign the angels gave the shepherds?", "A baby wrapped in swaddling clothes, lying in a manger|Manger|Swaddling clothes", "Luke 2:12"],
];

const PLACES: T[] = [
  ["In what town was Jesus born?", "Bethlehem", "Matthew 2:1"],
  ["In what town did Jesus grow up?", "Nazareth", "Matthew 2:23"],
  ["In what river was Jesus baptized?", "The Jordan|Jordan", "Matthew 3:13"],
  ["In what village did Jesus turn water into wine?", "Cana", "John 2:1"],
  ["In what garden did Jesus pray before His arrest?", "Gethsemane", "Matthew 26:36"],
  ["What was the place of Jesus' crucifixion called?", "Golgotha|Calvary", "John 19:17; Luke 23:33"],
  ["On what mountain did Moses receive the Ten Commandments?", "Sinai|Mount Sinai|Horeb", "Exodus 19:20"],
  ["On what mountains did the ark come to rest?", "Ararat|Mountains of Ararat", "Genesis 8:4"],
  ["What sea did God part for Israel?", "The Red Sea|Red Sea", "Exodus 14:21–22"],
  ["Which city's walls fell after Israel marched around it?", "Jericho", "Joshua 6:20"],
  ["On what mountain did Elijah face the prophets of Baal?", "Carmel|Mount Carmel", "1 Kings 18:19"],
  ["To what city was Jonah sent to preach?", "Nineveh", "Jonah 1:2"],
  ["Which two cities did God destroy with fire and brimstone?", "Sodom and Gomorrah|Gomorrah and Sodom", "Genesis 19:24"],
  ["On what island did John receive the Revelation?", "Patmos", "Revelation 1:9"],
  ["Where were followers of Jesus first called Christians?", "Antioch", "Acts 11:26"],
  ["In what land did Abraham's family live before God called him (city of his birth)?", "Ur|Ur of the Chaldees", "Genesis 11:31"],
  ["What land did God promise to Abraham's descendants?", "Canaan", "Genesis 17:8"],
  ["Where did Israel live as slaves for 400 years?", "Egypt", "Genesis 15:13; Exodus 1"],
  ["What city did David make his capital?", "Jerusalem", "2 Samuel 5:6–9"],
  ["Where was Daniel taken as a captive?", "Babylon", "Daniel 1:1–6"],
];

const NUMBERS: T[] = [
  ["How many days and nights did it rain in the flood?", "40", "Genesis 7:12"],
  ["How many years did Israel wander in the wilderness?", "40", "Numbers 14:33"],
  ["How many days was Jesus tempted in the wilderness?", "40", "Matthew 4:2"],
  ["How many plagues did God send on Egypt?", "10", "Exodus 7–12"],
  ["How many tribes of Israel were there?", "12", "Genesis 49:28"],
  ["How many apostles did Jesus choose?", "12", "Luke 6:13"],
  ["How many loaves did Jesus use to feed the 5,000?", "5", "John 6:9"],
  ["How many baskets of leftovers were gathered after feeding the 5,000?", "12", "John 6:13"],
  ["How many pieces of silver was Judas paid?", "30", "Matthew 26:15"],
  ["How many days was Jonah inside the fish?", "3", "Jonah 1:17"],
  ["How old was Abraham when Isaac was born?", "100", "Genesis 21:5"],
  ["How many men were in Gideon's army against Midian?", "300", "Judges 7:7"],
  ["How many books are in the Bible?", "66", "Protestant canon"],
  ["How many spies did Moses send into Canaan?", "12", "Numbers 13:1–16"],
  ["On which day of creation did God rest?", "7|Seventh|7th", "Genesis 2:2"],
  ["How many times did Peter deny Jesus?", "3", "Luke 22:61"],
  ["How many days was Lazarus in the tomb before Jesus came?", "4", "John 11:17"],
  ["How many verses are in Psalm 117, the shortest chapter?", "2", "Psalm 117"],
  ["How many verses are in Psalm 119, the longest chapter?", "176", "Psalm 119"],
];

// [statement, true?, reference, explanation]
const TRUE_FALSE: [string, boolean, string, string][] = [
  ["The Bible says three wise men visited Jesus.", false, "Matthew 2:1–11", "It names three gifts, but never the number of wise men."],
  ["The Bible says Eve ate an apple.", false, "Genesis 3:6", "It only says “fruit.”"],
  ["Noah took only two of every kind of animal.", false, "Genesis 7:2–3", "Seven pairs of every clean animal and bird; two of the unclean."],
  ["Moses led Israel into the Promised Land.", false, "Deuteronomy 34:4–5; Joshua 1:2", "Moses saw it from Mount Nebo; Joshua led them in."],
  ["Paul was one of the original twelve apostles.", false, "Matthew 10:2–4; Acts 9", "He was called later, on the road to Damascus."],
  ["Jesus was born in Nazareth.", false, "Matthew 2:1", "Born in Bethlehem, raised in Nazareth."],
  ["The book of Esther never mentions God by name.", true, "Esther", "God's providence is everywhere in it, but He is never named."],
  ["Both Luke and Acts are addressed to Theophilus.", true, "Luke 1:3; Acts 1:1", "The same author wrote both."],
  ["Genesis 3 calls the serpent “Satan” by name.", false, "Genesis 3; Revelation 12:9", "Revelation later identifies the ancient serpent as Satan."],
  ["David was the youngest son of Jesse.", true, "1 Samuel 16:11; 17:14", ""],
  ["The Bible calls Mary Magdalene a prostitute.", false, "Luke 8:2", "It says seven demons had gone out of her — nothing more."],
  ["The word “Trinity” appears in the Bible.", false, "Matthew 28:19", "The doctrine is drawn from the text, but the word isn't used."],
  ["Lot's wife turned to stone.", false, "Genesis 19:26", "She became a pillar of salt."],
  ["Zacchaeus was short.", true, "Luke 19:3", "“Little of stature.”"],
  ["The parable of the Prodigal Son is in Matthew.", false, "Luke 15:11–32", "It's in Luke."],
  ["The parable of the Good Samaritan is in Luke.", true, "Luke 10:25–37", ""],
  ["The book of Hebrews names its author.", false, "Hebrews", "The author is never named; Paul, Apollos and Barnabas have all been suggested."],
  ["Jesus had brothers named James and Judas (Jude).", true, "Matthew 13:55", "Also Joses and Simon."],
  ["There are twelve Minor Prophets.", true, "Hosea–Malachi", "“Minor” means shorter, not less important."],
  ["Elisha buried Elijah.", false, "2 Kings 2:11", "Elijah was taken up in a whirlwind."],
  ["Samson's strength was connected to his uncut hair.", true, "Judges 16:17", ""],
  ["Jonah obeyed God the first time he was told to go to Nineveh.", false, "Jonah 1:3", "He fled toward Tarshish."],
  ["Jesus wept is the shortest verse in the King James Bible.", true, "John 11:35", ""],
  ["The Ten Commandments appear in both Exodus and Deuteronomy.", true, "Exodus 20; Deuteronomy 5", ""],
  ["Solomon built the first temple in Jerusalem.", true, "1 Kings 6", "David gathered materials; Solomon built it."],
  ["Methuselah was Noah's grandfather.", true, "Genesis 5:25–29", "Methuselah → Lamech → Noah."],
];

// Sayings: [saying, in the Bible?, explanation]
const IN_BIBLE: [string, boolean, string][] = [
  ["God helps those who help themselves.", false, "An old proverb, popularized by Benjamin Franklin's Poor Richard's Almanack (1736)."],
  ["Cleanliness is next to godliness.", false, "Quoted as a proverb by John Wesley in a 1791 sermon."],
  ["This too shall pass.", false, "A folk saying from Persian and Jewish legend, not Scripture."],
  ["Money is the root of all evil.", false, "Close: 1 Timothy 6:10 says “the love of money is the root of all evil.”"],
  ["Spare the rod, spoil the child.", false, "From Samuel Butler's poem Hudibras (1663). Compare Proverbs 13:24."],
  ["God works in mysterious ways.", false, "From William Cowper's hymn “God Moves in a Mysterious Way” (1773)."],
  ["God won't give you more than you can handle.", false, "1 Corinthians 10:13 is about temptation and a way of escape — not hardship in general."],
  ["Hate the sin, love the sinner.", false, "A paraphrase of Augustine (Letter 211), not a Bible verse."],
  ["Everything happens for a reason.", false, "A popular saying. Romans 8:28 says God works all things together for good for those who love Him."],
  ["The lion shall lie down with the lamb.", false, "Isaiah 11:6 says the wolf shall dwell with the lamb and the leopard lie down with the kid."],
  ["To thine own self be true.", false, "Shakespeare, Hamlet (Polonius)."],
  ["God doesn't call the qualified; He qualifies the called.", false, "A modern saying."],
  ["Pride goes before a fall.", false, "Close: Proverbs 16:18 — “Pride goeth before destruction, and an haughty spirit before a fall.”"],
  ["Be still, and know that I am God.", true, "Psalm 46:10."],
  ["Jesus wept.", true, "John 11:35."],
  ["Iron sharpeneth iron.", true, "Proverbs 27:17."],
  ["The truth shall make you free.", true, "John 8:32."],
  ["Faith without works is dead.", true, "James 2:20, 26."],
  ["A man after his own heart.", true, "1 Samuel 13:14 — said of David."],
  ["There is nothing new under the sun.", true, "Ecclesiastes 1:9 — “there is no new thing under the sun” (KJV)."],
  ["Am I my brother's keeper?", true, "Genesis 4:9 — Cain's answer to God."],
  ["By the skin of my teeth.", true, "Job 19:20 — “I am escaped with the skin of my teeth.”"],
  ["Eat, drink, and be merry.", true, "Luke 12:19 (the rich fool); see also Ecclesiastes 8:15."],
  ["Moderation in all things.", false, "An ancient Greek maxim. Philippians 4:5 (KJV) says “Let your moderation be known unto all men.”"],
];

// Who said it: [quote, speaker, reference, three wrong choices]
const WHO_SAID: [string, string, string, string[]][] = [
  ["As for me and my house, we will serve the LORD.", "Joshua", "Joshua 24:15", ["Moses", "David", "Paul"]],
  ["I can do all things through Christ which strengtheneth me.", "Paul", "Philippians 4:13", ["Peter", "David", "Timothy"]],
  ["I am the way, the truth, and the life.", "Jesus", "John 14:6", ["Paul", "John the Baptist", "Peter"]],
  ["Whither thou goest, I will go.", "Ruth", "Ruth 1:16", ["Naomi", "Esther", "Hannah"]],
  ["Though he slay me, yet will I trust in him.", "Job", "Job 13:15", ["David", "Jeremiah", "Paul"]],
  ["Here am I; send me.", "Isaiah", "Isaiah 6:8", ["Jeremiah", "Moses", "Samuel"]],
  ["Silver and gold have I none; but such as I have give I thee.", "Peter", "Acts 3:6", ["Paul", "John", "Jesus"]],
  ["I have fought a good fight, I have finished my course.", "Paul", "2 Timothy 4:7", ["Timothy", "Peter", "Joshua"]],
  ["Thou art the Christ, the Son of the living God.", "Peter", "Matthew 16:16", ["John the Baptist", "Thomas", "Martha"]],
  ["Not my will, but thine, be done.", "Jesus", "Luke 22:42", ["Paul", "Mary", "David"]],
  ["He must increase, but I must decrease.", "John the Baptist", "John 3:30", ["Paul", "Peter", "Andrew"]],
  ["Speak; for thy servant heareth.", "Samuel", "1 Samuel 3:10", ["Eli", "Moses", "Elijah"]],
  ["If I perish, I perish.", "Esther", "Esther 4:16", ["Ruth", "Deborah", "Mordecai"]],
  ["Who knoweth whether thou art come to the kingdom for such a time as this?", "Mordecai", "Esther 4:14", ["Esther", "Nehemiah", "Daniel"]],
  ["My Lord and my God.", "Thomas", "John 20:28", ["Peter", "Mary Magdalene", "John"]],
  ["Am I my brother's keeper?", "Cain", "Genesis 4:9", ["Esau", "Abel", "Joseph's brothers"]],
  ["The LORD gave, and the LORD hath taken away; blessed be the name of the LORD.", "Job", "Job 1:21", ["David", "Solomon", "Naomi"]],
  ["Lord, I believe; help thou mine unbelief.", "A father whose son needed healing", "Mark 9:24", ["Thomas", "Peter", "Nicodemus"]],
];

// Quotes from outside the Bible (the "Pastors & authors" category).
const WHO_SAID_OUTSIDE: [string, string, string, string[]][] = [
  ["Aim at heaven and you will get earth thrown in.", "C.S. Lewis", "Mere Christianity (not the Bible)", ["Paul", "Jesus", "Solomon"]],
  ["Our heart is restless until it rests in you.", "Augustine", "Confessions, Book 1 (not the Bible)", ["David", "Paul", "C.S. Lewis"]],
  ["God helps those who help themselves.", "Benjamin Franklin (popularized)", "Poor Richard's Almanack, 1736 (not the Bible)", ["Solomon", "Paul", "James"]],
  ["Cleanliness is next to godliness.", "John Wesley (quoting a proverb)", "Sermon “On Dress,” 1791 (not the Bible)", ["Moses", "Paul", "Leviticus"]],
];

// True/false on famous attributions.
const ATTRIBUTIONS: [string, boolean, string][] = [
  ["C.S. Lewis wrote: “Humility is not thinking less of yourself, it is thinking of yourself less.”", false, "Widely credited to Lewis, but not found in his writings — a later paraphrase of an idea in Mere Christianity."],
  ["C.S. Lewis wrote: “You don't have a soul. You are a soul. You have a body.”", false, "Often credited to Lewis; it doesn't appear in his works."],
  ["C.S. Lewis wrote that he believed in Christianity “as I believe that the sun has risen.”", true, "From his essay “Is Theology Poetry?” (1945)."],
];

const split = (a: string) => a.split("|");
const text = (cat: Category, list: T[]): QCard[] =>
  list.map(([q, a, ref, explain], i) => ({ id: `${cat}-${i}`, cat, prompt: q, kind: "text", answers: split(a), ref, explain }));

export const CURATED: QCard[] = [
  ...text("people", PEOPLE),
  ...text("events", EVENTS),
  ...text("places", PLACES),
  ...text("numbers", NUMBERS),
  ...TRUE_FALSE.map(([s, t, ref, explain], i): QCard => ({ id: `tf-${i}`, cat: "truefalse", prompt: "True or false?", quote: s, kind: "tf", answers: [t ? "True" : "False"], ref, explain })),
  ...ATTRIBUTIONS.map(([s, t, explain], i): QCard => ({ id: `attr-${i}`, cat: "teachers", prompt: "True or false?", quote: s, kind: "tf", answers: [t ? "True" : "False"], explain })),
  ...IN_BIBLE.map(([s, yes, explain], i): QCard => ({
    id: `in-${i}`,
    cat: "inbible",
    prompt: "Is this in the Bible?",
    quote: s,
    kind: "mc",
    choices: ["In the Bible", "Not in the Bible"],
    answers: [yes ? "In the Bible" : "Not in the Bible"],
    explain,
  })),
  ...WHO_SAID.map(([s, who, ref, wrong], i): QCard => ({ id: `who-${i}`, cat: "whosaid", prompt: "Who said it?", quote: s, kind: "mc", choices: shuffle([who, ...wrong]), answers: [who], ref })),
  ...WHO_SAID_OUTSIDE.map(([s, who, ref, wrong], i): QCard => ({ id: `who-out-${i}`, cat: "teachers", prompt: "Who said it?", quote: s, kind: "mc", choices: shuffle([who, ...wrong]), answers: [who], ref })),
  ...TEACHER_CARDS,
];

// ---------- Generated questions ----------

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
export function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const otherBooks = (b: Book, n: number, sameTestament = true) =>
  shuffle(BOOKS.filter((x) => x.n !== b.n && (!sameTestament || (x.n <= 39) === (b.n <= 39)))).slice(0, n);

function bookCard(hebrewsWithPaul: boolean): QCard {
  const b = pick(BOOKS);
  const kind = Math.floor(Math.random() * 4);
  const id = `gen-book-${kind}-${b.n}`;
  if (kind === 0) return { id, cat: "books", prompt: `How many chapters are in ${b.name}?`, kind: "text", answers: [String(b.chapters)] };
  if (kind === 1 && b.n < 66) return { id, cat: "books", prompt: `Which book comes right after ${b.name}?`, kind: "text", answers: [book(b.n + 1).name, book(b.n + 1).short] };
  if (kind === 2) {
    const right = SECTIONS.find((s) => s.id === sectionOf(b, hebrewsWithPaul))!.name;
    const wrong = shuffle(SECTIONS.filter((s) => s.name !== right).map((s) => s.name)).slice(0, 3);
    return { id, cat: "books", prompt: `Which part of the Bible is ${b.name} in?`, kind: "mc", choices: shuffle([right, ...wrong]), answers: [right] };
  }
  return { id, cat: "books", prompt: "True or false?", quote: `${b.name} is in the New Testament.`, kind: "tf", answers: [b.n > 39 ? "True" : "False"] };
}

const STOP = new Set("unto that which shall their there these those with from have hath were they them thee thou your shalt said upon when then also into will what because him his her them for and the".split(" "));

async function verseCard(version: string): Promise<QCard> {
  const b = pick(BOOKS);
  const chapters = await loadBook(version, b.n);
  const c = Math.floor(Math.random() * chapters.length);
  const v = Math.floor(Math.random() * chapters[c].length);
  const t = chapters[c][v];
  if (!t) return verseCard(version); // a verse this translation omits
  const ref = `${b.name} ${c + 1}:${v + 1}`;
  const kind = Math.floor(Math.random() * 3);
  const id = `gen-verse-${kind}-${b.n}-${c}-${v}`;
  if (kind === 0 || t.split(" ").length < 6) {
    const choices = shuffle([b, ...otherBooks(b, 3)]).map((x) => x.name);
    return { id, cat: "verses", prompt: "Which book is this verse from?", quote: t, kind: "mc", choices, answers: [b.name], ref, explain: `${version}` };
  }
  if (kind === 1) {
    const words = t.split(" ");
    const candidates = words.map((w, i) => [w.replace(/[^A-Za-z'’]/g, ""), i] as [string, number]).filter(([w]) => w.length >= 5 && !STOP.has(w.toLowerCase()));
    if (candidates.length) {
      const [w, i] = pick(candidates);
      const blanked = words.map((x, j) => (j === i ? x.replace(w, "_____") : x)).join(" ");
      return { id, cat: "verses", prompt: `Fill in the missing word (${ref})`, quote: blanked, kind: "text", answers: [w], ref };
    }
  }
  const claimed = Math.random() < 0.5 ? b : otherBooks(b, 1)[0];
  return { id, cat: "verses", prompt: "True or false?", quote: `“${t}” is from ${claimed.name}.`, kind: "tf", answers: [claimed.n === b.n ? "True" : "False"], ref };
}

/** The next question for the chosen categories. Generated ones never run out. */
export async function nextCard(cats: Category[], opts: { versions: string[]; outside: boolean; hebrewsWithPaul: boolean; custom: CustomCard[]; recent: Set<string> }): Promise<QCard> {
  const pool: (QCard | "book" | "verse")[] = [];
  const use = (c: Category) => (cats.length === 0 || cats.includes(c)) && (opts.outside || c !== "teachers");
  for (const q of CURATED) if (use(q.cat) && !opts.recent.has(q.id)) pool.push(q);
  opts.custom.forEach((c, i) => use("mine") && !opts.recent.has(`mine-${i}`) && pool.push({ id: `mine-${i}`, cat: "mine", prompt: c.q, kind: "text", answers: split(c.a), explain: c.note }));
  // Generated questions get a fair share of the mix.
  if (use("books")) for (let i = 0; i < 25; i++) pool.push("book");
  if (use("verses")) for (let i = 0; i < 40; i++) pool.push("verse");
  if (!pool.length) {
    // Every card here was asked recently: start over. Nothing at all to ask: ask anything.
    if (opts.recent.size) {
      opts.recent.clear();
      return nextCard(cats, opts);
    }
    return nextCard([], opts);
  }
  const p = pick(pool);
  if (p === "book") return bookCard(opts.hebrewsWithPaul);
  if (p === "verse") return verseCard(pick(opts.versions.length ? opts.versions : ["KJV"]));
  return p.kind === "mc" && (p.cat === "whosaid" || p.cat === "teachers") ? { ...p, choices: shuffle(p.choices!) } : p;
}

export const CURATED_COUNT = CURATED.length;
