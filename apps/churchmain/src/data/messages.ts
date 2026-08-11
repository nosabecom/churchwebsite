export type Message = {
    slug: string;
    title: string;
    speaker: string;
    date: string;
    isoDate: string;
    series: string;
    duration: string;
    scripture: string;
    youtubeId: string;
    summary: string;
    quote: string;
    transcript: string[];
    keyScriptures: Array<{ reference: string; note: string }>;
    keyPoints: string[];
};

export const messages: Message[] = [
    {
        slug: "built-on-the-rock",
        title: "Built on the Rock",
        speaker: "Pastor Reuben Adeleye",
        date: "August 3, 2026",
        isoDate: "2026-08-03",
        series: "Hope & Restoration",
        duration: "42:18",
        scripture: "Matthew 7:24–27",
        youtubeId: "YuAT3ENdDq0",
        summary: "A steady life is built by hearing the words of Jesus—and putting them into practice.",
        quote: "Everyone who hears these words of mine and puts them into practice is like a wise man who built his house on the rock.",
        transcript: [
            "Good morning, church. Today we are looking at the kind of foundation that remains when life becomes uncertain. Jesus ends the Sermon on the Mount by bringing every listener to a decision: will these words stay in our hearing, or will they become the pattern of our lives?",
            "The storm reaches both houses. Faith does not mean a life without pressure, questions, or difficult seasons. The difference is what has been built beneath the surface before the wind begins to blow. A steady life is formed through repeated obedience to the words of Jesus.",
            "Hearing is the beginning, but practice is the foundation. Every time we forgive, pray, give, serve, tell the truth, or choose trust over fear, we are placing another stone on the rock. The small acts of obedience that nobody applauds become strength when the storm arrives.",
            "This week, do not leave the message as inspiration alone. Return to the passage, name the instruction God is emphasizing, and take one concrete step. Build with other believers around you, and let the word of Christ become visible in the way you live.",
        ],
        keyScriptures: [
            { reference: "Matthew 7:24–27", note: "The wise and foolish builders" },
            { reference: "James 1:22–25", note: "Doers of the word" },
            { reference: "1 Corinthians 3:11", note: "Christ, the sure foundation" },
        ],
        keyPoints: [
            "Storms reveal foundations; they do not create them.",
            "Hearing becomes strength through practiced obedience.",
            "A lasting faith is built one faithful decision at a time.",
        ],
    },
    {
        slug: "the-god-who-sees",
        title: "The God Who Sees",
        speaker: "Pastor Toyin Adeleye",
        date: "July 27, 2026",
        isoDate: "2026-07-27",
        series: "Encounters",
        duration: "36:04",
        scripture: "Genesis 16:7–14",
        youtubeId: "yD5P8YAu5VM",
        summary: "God meets us in overlooked places and reminds us that no life is invisible to him.",
        quote: "You are the God who sees me.",
        transcript: [
            "Hagar’s story begins in a place of rejection, but it does not end there. God meets her in the wilderness and asks questions that restore her dignity and direction.",
            "The Lord sees more than our circumstances. He sees the person carrying them, the fear beneath the words, and the future that still feels impossible to imagine.",
            "Being seen by God is not passive comfort. His attention calls us back toward promise, community, and faithful next steps.",
            "Wherever you feel overlooked, remember that the God who sees also speaks, guides, and provides.",
        ],
        keyScriptures: [
            { reference: "Genesis 16:7–14", note: "Hagar meets the God who sees" },
            { reference: "Psalm 139:1–12", note: "Known completely by God" },
            { reference: "Luke 12:6–7", note: "You are not forgotten" },
        ],
        keyPoints: [
            "God meets people in overlooked places.",
            "Divine attention restores dignity and direction.",
            "Being seen gives courage for the next faithful step.",
        ],
    },
    {
        slug: "grace-for-the-journey",
        title: "Grace for the Journey",
        speaker: "Pastor Reuben Adeleye",
        date: "July 20, 2026",
        isoDate: "2026-07-20",
        series: "Summer Psalms",
        duration: "48:30",
        scripture: "Psalm 121",
        youtubeId: "UqUJssLziVM",
        summary: "Receive strength for every mile of the journey from the God who keeps us.",
        quote: "My help comes from the Lord, the Maker of heaven and earth.",
        transcript: [
            "Psalm 121 is a song for people on the move. The road is real, the distance is real, and so is the help of God.",
            "Our confidence is not in the hills themselves but in the Maker of heaven and earth. The One who created the road is able to keep us on it.",
            "God’s care is continuous. He does not drift, doze, or lose sight of his people when the journey becomes long.",
            "Lift your eyes again. Your help is not limited by your energy, your resources, or what you can currently see.",
        ],
        keyScriptures: [
            { reference: "Psalm 121", note: "The Lord watches over you" },
            { reference: "Isaiah 40:28–31", note: "Strength for the weary" },
            { reference: "Psalm 46:1", note: "A present help in trouble" },
        ],
        keyPoints: [
            "The source of help matters more than the size of the road.",
            "God’s keeping presence does not take a break.",
            "Looking to God changes how we carry the journey.",
        ],
    },
    {
        slug: "faith-in-the-waiting",
        title: "Faith in the Waiting",
        speaker: "Minister Sarah O.",
        date: "July 13, 2026",
        isoDate: "2026-07-13",
        series: "Anchored",
        duration: "31:52",
        scripture: "Hebrews 10:23",
        youtubeId: "a9Pn8404Mvk",
        summary: "Waiting is not wasted when our confidence rests in the faithfulness of God.",
        quote: "Let us hold unswervingly to the hope we profess.",
        transcript: [
            "Waiting can make us question whether anything is happening, but Scripture teaches us that faithfulness continues before the answer arrives.",
            "Christian hope is anchored in the character of the One who promised. We hold on because God is trustworthy, not because every circumstance is easy to explain.",
            "We also wait together. Encouragement, prayer, and gathering keep isolation from turning delay into despair.",
            "Let the waiting season deepen your roots. Keep showing up, keep serving, and keep confessing the hope you have in Christ.",
        ],
        keyScriptures: [
            { reference: "Hebrews 10:23–25", note: "Hold fast and encourage one another" },
            { reference: "Romans 5:3–5", note: "Suffering produces hope" },
            { reference: "Isaiah 40:31", note: "Those who wait renew their strength" },
        ],
        keyPoints: [
            "Hope rests on God’s faithfulness, not our timetable.",
            "Waiting is active trust rather than spiritual inactivity.",
            "Community helps us hold on without losing heart.",
        ],
    },
    {
        slug: "called-to-flourish",
        title: "Called to Flourish",
        speaker: "Pastor Toyin Adeleye",
        date: "July 6, 2026",
        isoDate: "2026-07-06",
        series: "Rooted",
        duration: "39:16",
        scripture: "Psalm 1:1–3",
        youtubeId: "rQ5-Dqn1ofw",
        summary: "God calls us to a rooted life that bears fruit in every season.",
        quote: "That person is like a tree planted by streams of water.",
        transcript: [
            "Psalm 1 gives us a picture of a life that remains fruitful because its roots have found the right source.",
            "Flourishing begins with attention: what we listen to, what we delight in, and what we allow to shape our imagination.",
            "The tree does not manufacture the stream. It stays planted near the supply that God has provided.",
            "Choose the habits and relationships that keep you near the word. Fruit will come in its season when the roots are consistently nourished.",
        ],
        keyScriptures: [
            { reference: "Psalm 1:1–3", note: "A tree planted by streams" },
            { reference: "John 15:4–5", note: "Abide in Christ" },
            { reference: "Galatians 5:22–23", note: "The fruit of the Spirit" },
        ],
        keyPoints: [
            "Visible fruit begins with invisible roots.",
            "Delight shapes direction over time.",
            "Consistency near God’s word produces seasonal fruitfulness.",
        ],
    },
    {
        slug: "a-table-in-the-wilderness",
        title: "A Table in the Wilderness",
        speaker: "Pastor Reuben Adeleye",
        date: "June 29, 2026",
        isoDate: "2026-06-29",
        series: "Summer Psalms",
        duration: "44:09",
        scripture: "Psalm 23:5",
        youtubeId: "wrOvChccjMI",
        summary: "God’s provision is not limited by the wilderness surrounding us.",
        quote: "You prepare a table before me.",
        transcript: [
            "David describes a table prepared in the presence of enemies. The surrounding pressure has not disappeared, but God’s provision is already present.",
            "The Shepherd does not only lead us through valleys; he welcomes us to a place of belonging, nourishment, and abundance.",
            "Grace gives us the ability to receive peace before every conflict is resolved.",
            "Sit at the table God has prepared. Let his goodness steady you, and carry that welcome to someone else who needs it.",
        ],
        keyScriptures: [
            { reference: "Psalm 23:5–6", note: "A table and an overflowing cup" },
            { reference: "Isaiah 25:6", note: "The Lord prepares a feast" },
            { reference: "Luke 22:19–20", note: "The table of the new covenant" },
        ],
        keyPoints: [
            "God can provide in the presence of pressure.",
            "The Shepherd’s table communicates belonging.",
            "Received grace becomes welcome we extend to others.",
        ],
    },
    {
        slug: "peace-in-the-storm",
        title: "Peace in the Storm",
        speaker: "Pastor Toyin Adeleye",
        date: "June 22, 2026",
        isoDate: "2026-06-22",
        series: "Anchored",
        duration: "39:54",
        scripture: "Mark 4:39",
        youtubeId: "wrOvChccjMI",
        summary: "Jesus meets us in the storm and teaches us to trust the authority of his presence.",
        quote: "Peace, be still.",
        transcript: [
            "The disciples entered the boat at Jesus’ invitation, yet obedience did not keep the storm from arriving.",
            "Fear tells us that the waves have the final word. Faith remembers that Christ is present even when he seems silent.",
            "Jesus speaks peace to the wind and then invites his followers into a deeper confidence in who he is.",
            "The storm may expose our fear, but it can also reveal the steadiness of the One who travels with us.",
        ],
        keyScriptures: [
            { reference: "Mark 4:35–41", note: "Jesus calms the storm" },
            { reference: "Psalm 46:1–3", note: "God is present in trouble" },
            { reference: "John 14:27", note: "Christ gives lasting peace" },
        ],
        keyPoints: [
            "Obedience does not guarantee an absence of storms.",
            "Christ’s presence is greater than the pressure around us.",
            "Peace grows as we trust the authority of Jesus.",
        ],
    },
];

export const series = [...new Set(messages.map((message) => message.series))];
export const speakers = [...new Set(messages.map((message) => message.speaker))];
export const years = [...new Set(messages.map((message) => message.isoDate.slice(0, 4)))];

export function getMessage(slug: string) {
    return messages.find((message) => message.slug === slug);
}
