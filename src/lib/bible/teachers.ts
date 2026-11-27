// "Who taught it?" cards: teachings by John Bevere, Josh Howerton and Charlie Kirk, each
// summarized in our own words from a source we checked (their own articles, book excerpts,
// devotional plans, official sermon pages, or news reports of a named sermon/event).
// They're paraphrases, not exact quotes — tap "See the source" for the original wording.
// Add exact quotes you've heard yourself under My cards.
import type { QCard } from "./questions";

const BEVERE = "John Bevere";
const HOWERTON = "Josh Howerton";
const KIRK = "Charlie Kirk";
const CHOICES = [BEVERE, HOWERTON, KIRK, "Billy Graham"];

// [teaching (paraphrased), who, where it's from, link]
const T: [string, string, string, string][] = [
  // ---- John Bevere ----
  [
    "Offense is the enemy's bait. The Greek word for offense, skandalon, first meant the part of a trap that held the bait.",
    BEVERE,
    "The Bait of Satan (1994), chapter 1",
    "https://mycharisma.com/?p=409896",
  ],
  [
    "Offended people fall into two groups: those who really were wronged, and those who only think they were. Both end up trapped.",
    BEVERE,
    "The Bait of Satan (1994)",
    "https://mycharisma.com/?p=409896",
  ],
  [
    "When Jesus said “the love of many will grow cold,” He meant Christians. Unresolved offense is what cools their love.",
    BEVERE,
    "Article on Matthew 24:12 (ChurchLeaders, 2023)",
    "https://churchleaders.com/outreach-missions/312721-dont-let-love-grow-cold-john-bevere.html",
  ],
  [
    "Fearing God is not the same as being afraid of God. Being afraid hides from Him like Adam did, while holy fear draws near like Moses did.",
    BEVERE,
    "The Awe of God (2023)",
    "https://www.biblegateway.com/blog/?p=71902",
  ],
  [
    "Holy fear pushes out every other fear. Any fear that remains shows something not yet surrendered to the cross.",
    BEVERE,
    "The Awe of God (2023)",
    "https://www.biblegateway.com/learn/voices/fear-that-eliminates-fears/",
  ],
  [
    "Obedience is the evidence that you fear God. Obey right away, even when it hurts or makes no sense, and all the way, because delayed or partial obedience is disobedience.",
    BEVERE,
    "“How to Know if You Fear God” (2017)",
    "https://churchleaders.com/outreach-missions/outreach-missions-articles/307300-know-fear-god-john-bevere.html",
  ],
  [
    "Grace isn't only unearned forgiveness. It is God's power that lets you go beyond your natural ability, and He makes your calling bigger than your ability on purpose.",
    BEVERE,
    "Devotional on grace; also in his book X",
    "https://www.biblegateway.com/learn/voices/grace-beyond-ability/",
  ],
  [
    "In the parable of the talents, faithfulness means multiplying what God gave you for others. Settling into comfort is burying your talent.",
    BEVERE,
    "X: Multiply Your God-Given Potential (2020)",
    "https://www.bible.com/reading-plans/22450-x-multiply-your-potential-with-john-bevere/day/5",
  ],
  [
    "“Good” and “God” aren't the same thing. Something can look good and still lead to death, and Eve fell believing God was holding back something good.",
    BEVERE,
    "Good or God? (2015)",
    "https://www.bible.com/reading-plans/1709-good-or-god-with-john-bevere/day/1",
  ],
  [
    "Like Superman, the church has a “kryptonite” that drains its power: idolatry, including greed. And true worship is obedience, not a slow song.",
    BEVERE,
    "Killing Kryptonite (2017)",
    "https://www.bible.com/reading-plans/4846-killing-kryptonite-with-john-bevere/day/2",
  ],
  [
    "Eternal judgment is a foundational doctrine (Hebrews 6:1–2). God will make eternal decisions based on how each believer lived.",
    BEVERE,
    "Driven by Eternity (2006)",
    "https://www.bible.com/reading-plans/3082-driven-by-eternity-with-john-bevere/day/4",
  ],
  [
    "Finishing well matters more than starting well. Compare Solomon, who drifted into compromise, with John the Baptist, who stayed faithful to the end.",
    BEVERE,
    "Relentless (2011)",
    "https://www.cfaith.com/when-you-re-ready-to-throw-in-the-towel",
  ],
  [
    "Arm yourself to suffer before the trial comes (1 Peter 4:1). Trouble is certain, so treat it as an opportunity.",
    BEVERE,
    "Relentless (2011)",
    "https://mycharisma.com/spiritual-warfare/armed-for-the-assauit/",
  ],
  [
    "God's authority is a covering of protection and provision, not a restriction. Adam and Eve lost that covering when they stepped out from under it.",
    BEVERE,
    "Under Cover (2001)",
    "https://cfaith.com/understanding-authority",
  ],
  [
    "God tests us to see if He can trust us, the way an airplane is tested before it carries passengers. Life's tests are open-book, and you often don't know it was a test until it's over.",
    BEVERE,
    "“Does God Trust You?” (2018)",
    "https://churchleaders.com/outreach-missions/outreach-missions-articles/336609-does-god-trust-you.html",
  ],
  [
    "God often uses a hidden wilderness season to build character before a calling. Early success ruined Saul, while David refused shortcuts.",
    BEVERE,
    "“The Danger of Premature Success” (2019)",
    "https://churchleaders.com/outreach-missions/outreach-missions-articles/341137-the-danger-of-premature-success.html",
  ],
  [
    "A man who hated his 38 years at IBM made a young intern resolve never to trade God's purpose for security.",
    BEVERE,
    "Driven by Eternity (2006)",
    "https://www.bible.com/reading-plans/3082-driven-by-eternity-with-john-bevere/day/6",
  ],

  // ---- Josh Howerton (Lakepointe Church) ----
  [
    "Discipleship doesn't start with trying harder. It starts by trusting that “It is finished” means your debt is paid and your identity isn't your performance.",
    HOWERTON,
    "“Boot Camp” series, Lakepointe (Jan 2026)",
    "https://www.youtube.com/watch?v=FxQYhwdVJdo",
  ],
  [
    "The enemy attacks when you're isolated, tired and distracted. Jesus answered temptation with Scripture (Luke 4), so the Bible is a weapon for war, not just information.",
    HOWERTON,
    "“Boot Camp” series, Lakepointe (Jan 2026)",
    "https://www.youtube.com/watch?v=VJYoIRGZURI",
  ],
  [
    "From the parable of the minas: a disciple stewards everything God gives, and the tithe shows who's on the throne of your heart. That's not the prosperity gospel.",
    HOWERTON,
    "“A Disciple Stewards EVERYTHING” (Feb 2026)",
    "https://www.youtube.com/watch?v=TkK8fx9M8hw",
  ],
  [
    "Your spouse isn't your enemy, and you protect what you prioritize. The grass is greener where you water it. (Afterward, 52 couples who had been living together got married.)",
    HOWERTON,
    "Marriage Weekend, Lakepointe (Feb 2026)",
    "https://www.youtube.com/watch?v=S9BYWnItpUQ",
  ],
  [
    "Prayer isn't a formula for controlling outcomes. It's an ongoing relationship with a loving Father, and that changes how you see unanswered prayer (Luke 11).",
    HOWERTON,
    "“5 Reasons God is Not Answering Your Prayers” (Mar 2026)",
    "https://www.youtube.com/watch?v=MJKPXzG9QOc",
  ],
  [
    "The Sabbath is the most ignored of the Ten Commandments. “Hurry sickness” and skipping weekly rest quietly damage souls, families and faith.",
    HOWERTON,
    "“The Most Ignored Commandment in the Bible” (Mar 2026)",
    "https://www.youtube.com/watch?v=lm0AIDB_7fc",
  ],
  [
    "Standing on two ladders: a new believer can keep a foot in both the Word and the world for a while, but the gap keeps widening until you have to choose whom you'll serve.",
    HOWERTON,
    "“Why Following Jesus Will Make You WEIRD” (Sep 2026)",
    "https://www.youtube.com/watch?v=gihr-TuaC0A",
  ],
  [
    "The Christian life is a relay, not a sprint or a marathon. Each generation has to pass the baton, and older believers must become spiritual parents to Gen Z.",
    HOWERTON,
    "“Don't Drop the Baton” (Nov 2025)",
    "https://www.youtube.com/watch?v=7lBm8BRcm38",
  ],
  [
    "Felix kept putting Paul off for a more convenient time. “Later” keeps more people out of heaven than unbelief does, and salvation is received, not earned by being good.",
    HOWERTON,
    "“The Lie That Keeps ‘Good People’ Out of Heaven” (Nov 2025)",
    "https://www.youtube.com/watch?v=QpT1lUwzGN4",
  ],
  [
    "From Paul's defense in Acts 26: every disciple should name their “one more,” the person they're praying for and sharing the gospel with. Evangelism is a team sport.",
    HOWERTON,
    "“How to Share The Gospel with ANYONE” (May 2026)",
    "https://www.youtube.com/watch?v=kSSCEqwsuJU",
  ],
  [
    "Fight FOR your marriage, not in it. The enemy's tactic is division, small offenses become prisons, and the cross makes forgiveness possible.",
    HOWERTON,
    "“Love Life” series (Sep 2025)",
    "https://www.youtube.com/watch?v=zU5CyO6hZZ0",
  ],
  [
    "One storyline runs from Eden to Jesus: we lost God's face in the garden, Moses saw only God's back, and at the Transfiguration Moses finally sees God's glory in Jesus inside the Promised Land.",
    HOWERTON,
    "His podcast, reported by Charisma (Jan 2026)",
    "https://mycharisma.com/spiritled-living/josh-howerton-reveals-one-moment-where-eden-moses-and-jesus-collide/",
  ],
  [
    "Comfortable lives that don't count for eternity are a warning. John Piper's “seashell sermon” on that theme changed his life, and he played it for his wife on their third date.",
    HOWERTON,
    "Sermon on the rich young ruler (Oct 2026)",
    "https://churchleaders.com/news/2224559-josh-howerton-john-pipers-seashell-sermon.html",
  ],
  [
    "Jesus died not just for us but instead of us, and because of the resurrection the worst thing is never the last thing.",
    HOWERTON,
    "Easter 2026, Luke 24",
    "https://www.youtube.com/watch?v=wRaqnIbS5Kw",
  ],
  [
    "You can't follow Jesus alone. You need spiritual fathers and mothers, and you should ask what one step God is asking of you next.",
    HOWERTON,
    "“Why You Can't Follow Jesus Alone” (Aug 2026)",
    "https://www.youtube.com/watch?v=R8tuE7FKYt8",
  ],

  // ---- Charlie Kirk ----
  [
    "Keeping the Sabbath isn't an optional tradition or a cultural leftover. It's essential for the human soul to flourish.",
    KIRK,
    "Stop, in the Name of God, his last book (Dec 2025)",
    "https://www.foxnews.com/politics/exclusive-charlie-kirks-final-book-battles-machine-modern-life-urges-return-sabbath",
  ],
  [
    "This book on rest is a manifesto against the machine of modern life. It's written to interrupt the reader's lifestyle, not to approve of it.",
    KIRK,
    "Stop, in the Name of God (Dec 2025)",
    "https://www.foxnews.com/politics/exclusive-charlie-kirks-final-book-battles-machine-modern-life-urges-return-sabbath",
  ],
  [
    "God rested on the seventh day because creation was full and complete, not because He was tired.",
    KIRK,
    "Stop, in the Name of God (Dec 2025)",
    "https://www.deseret.com/opinion/2025/12/12/stop-in-the-name-of-god-charlie-kirk-book-review/",
  ],
  [
    "Caffeine is like a loan shark: it borrows energy from tomorrow to pay for today, a sign of a culture that has forgotten how to rest.",
    KIRK,
    "Stop, in the Name of God (Dec 2025)",
    "https://www.deseret.com/opinion/2025/12/12/stop-in-the-name-of-god-charlie-kirk-book-review/",
  ],
  [
    "Work isn't a curse. It's taking part in God's order, so laziness is disobedience, not just inefficiency.",
    KIRK,
    "Stop, in the Name of God (Dec 2025)",
    "https://www.deseret.com/opinion/2025/12/12/stop-in-the-name-of-god-charlie-kirk-book-review/",
  ],
  [
    "Jesus slept through the storm. Resting is a way of trusting that God is enough.",
    KIRK,
    "Stop, in the Name of God (Dec 2025)",
    "https://www.deseret.com/opinion/2025/12/12/stop-in-the-name-of-god-charlie-kirk-book-review/",
  ],
  [
    "Daily habits like Scripture study, a short examination of conscience before bed, and a phone-free Sabbath are “anchoring tools” for surviving public battles.",
    KIRK,
    "Interview at Turning Point headquarters (Aug 2025)",
    "https://www.ksl.com/article/51373510/what-charlie-kirk-told-me-about-his-faith-and-legacy",
  ],
  [
    "Giving my life to the Lord in fifth grade was the most important decision I ever made.",
    KIRK,
    "Q&A at the 2023 Christian Leadership Summit",
    "https://www.iheart.com/podcast/1319-the-charlie-kirk-show-83947097/episode/from-the-archive-the-choice-to-336072131/",
  ],
  [
    "Happiness is a choice. Real joy comes from a relationship with the Lord, not from apps or substances.",
    KIRK,
    "Q&A at the 2023 Christian Leadership Summit",
    "https://www.iheart.com/podcast/1319-the-charlie-kirk-show-83947097/episode/from-the-archive-the-choice-to-336072131/",
  ],
  [
    "If everything else went away, I'd want to be remembered for courage in my faith, because my faith is the most important thing.",
    KIRK,
    "The Iced Coffee Hour interview (June 2025)",
    "https://www.ewtnnews.com/world/us/charlie-kirk-before-death-i-want-to-be-remembered-for-courage-for-my-faith",
  ],
  [
    "America is in a revival, with Gen Z going back to church in record numbers, and it's all about Jesus.",
    KIRK,
    "Fox & Friends, after Lamar Jackson shared his Sunday message (Aug 2025)",
    "https://www.foxnews.com/media/charlie-kirk-applauds-lamar-jacksons-courage-conviction-after-backlash-sharing-christian-message",
  ],
  [
    "Jesus defeated death so that you can live.",
    KIRK,
    "One of his last posts, days before his death (Sep 2025)",
    "https://www.foxnews.com/media/charlie-kirk-championed-christianity-campuses-nationwide-im-nothing-without-jesus",
  ],
  [
    "Jesus is the center of everything, Scripture is without error, and the church must never again be called “non-essential.”",
    KIRK,
    "TPUSA Faith Pastors Summit, Nashville (May 2023)",
    "https://churchleaders.com/news/451741-charlie-kirk-exhorts-church-leaders-at-sold-out-tpusa-faith-pastors-summit-if-you-love-god-you-must-hate-evil.html",
  ],
  [
    "Protestants don't honor Mary enough, and she is the answer to toxic feminism.",
    KIRK,
    "The Charlie Kirk Show (July 2025)",
    "https://www.churchpop.com/charlie-kirk-said-mary-is-the-solution-to-toxic-feminism-in-america-we-dont-talk-about-mary-enough/",
  ],
  [
    "When Bill Maher joked “He is risen” on Easter, he answered “He is risen indeed” and asked Maher whether he hoped heaven is real.",
    KIRK,
    "Club Random with Bill Maher (Easter 2025)",
    "https://religionunplugged.com/news/2025/9/18/he-is-risen-indeed-in-acloud-of-doubt-charlie-kirk-clung-to-the-cross",
  ],
];

// Quotes going around under someone's name that they didn't say: [claim, true?, why, link]
const MYTHS: [string, boolean, string, string][] = [
  [
    "The recording of Charlie Kirk saying “Death is not the end, it's a promotion,” played in some churches after he died, is really his voice.",
    false,
    "It was AI-generated. Prestonwood Baptist's pastor told his church it was a fabrication.",
    "https://www.dailydot.com/viral-politics/ai-charlie-kirk-church-service/",
  ],
  [
    "The viral “My Christianity rests on Georgians who defeated the Ottomans…” clip is Charlie Kirk.",
    false,
    "It's a different man in a 2018 Speakers' Corner video.",
    "https://mythdetector.com/en/falsely-attributed-to-charlie-kirk/",
  ],
  [
    "Charlie Kirk called for stoning gay people.",
    false,
    "He cited Leviticus to argue against picking Bible verses selectively. Stephen King repeated the claim, then retracted it and apologized.",
    "https://www.factcheck.org/2025/09/viral-claims-about-charlie-kirks-words/",
  ],
  [
    "John Bevere's book The Bait of Satan is about offense.",
    true,
    "Its subtitle is “Living Free from the Deadly Trap of Offense” (1994).",
    "https://mycharisma.com/?p=409896",
  ],
  [
    "Josh Howerton is the senior pastor of Lakepointe Church in Texas.",
    true,
    "Lakepointe is in the Dallas area.",
    "https://www.youtube.com/watch?v=S9BYWnItpUQ",
  ],
];

export const TEACHER_CARDS: QCard[] = [
  ...T.map(([idea, who, from, link], i): QCard => ({
  id: `teach-${i}`,
  cat: "teachers",
  prompt: "Who taught this? (in our words)",
  quote: idea,
  kind: "mc",
  choices: CHOICES,
  answers: [who],
  explain: from + ".",
  link,
})),
  ...MYTHS.map(([claim, yes, why, link], i): QCard => ({
    id: `teach-tf-${i}`,
    cat: "teachers",
    prompt: "True or false?",
    quote: claim,
    kind: "tf",
    answers: [yes ? "True" : "False"],
    explain: why,
    link,
  })),
];
