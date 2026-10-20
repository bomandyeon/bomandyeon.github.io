/* Bom & Yeon legacy data, extracted from saju-test/build/index-fixed.html (2026-10-20). */
(function(){
var SOULS = [
          { hanja: "甲", name: "Gap Wood", nick: "The tall tree", el: "Wood",
            tag: "Upright, stubborn in the best way, built to grow toward something bigger than today.",
            traits: ["Ambitious", "Loyal", "Hard to bend"],
            bom: "You never ask for permission to grow. That is the whole story.",
            love: "In love you are the one who plans the future out loud, and you mean every word of it." },
          { hanja: "乙", name: "Eul Wood", nick: "The vine", el: "Wood",
            tag: "Flexible, quietly persistent, always finding the way around the wall instead of through it.",
            traits: ["Adaptable", "Charming", "Quietly tough"],
            bom: "Soft on the outside, impossible to uproot. People underestimate you once.",
            love: "In love you give warmth easily and ask for very little, which is exactly what you should stop doing." },
          { hanja: "丙", name: "Byeong Fire", nick: "The sun", el: "Fire",
            tag: "Open, generous, impossible to ignore, warming people who never thought to thank you.",
            traits: ["Magnetic", "Honest", "All-in"],
            bom: "Rooms change temperature when you walk in. You've noticed.",
            love: "In love you burn bright and fast, and you want someone who can hold your light without hiding from it." },
          { hanja: "丁", name: "Jeong Fire", nick: "The candle", el: "Fire",
            tag: "Focused, intimate, the light people move closer to when they want the truth.",
            traits: ["Intuitive", "Devoted", "Private"],
            bom: "You don't light up crowds. You light up the one person who matters.",
            love: "In love you are deeply loyal and slow to show it, so the right person has to stay long enough to see." },
          { hanja: "戊", name: "Mu Earth", nick: "The mountain", el: "Earth",
            tag: "Steady, protective, slow to move and almost impossible to push once you decide.",
            traits: ["Dependable", "Patient", "Protective"],
            bom: "Everyone leans on you. Who do you lean on?",
            love: "In love you are the provider and the planner, and you attract people who need shelter." },
          { hanja: "己", name: "Gi Earth", nick: "The garden soil", el: "Earth",
            tag: "Nurturing, practical, the person who quietly makes things grow for everyone else.",
            traits: ["Caring", "Practical", "Modest"],
            bom: "You grow other people's gardens. Plant something of your own this year.",
            love: "In love you give steady care and quietly hope someone notices without being asked." },
          { hanja: "庚", name: "Gyeong Metal", nick: "Raw steel", el: "Metal",
            tag: "Direct, loyal and brave, with a strong sense of what is fair and what is not.",
            traits: ["Decisive", "Brave", "Blunt"],
            bom: "You say the thing everyone is thinking. That is a gift, not a flaw.",
            love: "In love you are fiercely protective and hopeless at small talk about feelings." },
          { hanja: "辛", name: "Sin Metal", nick: "The polished jewel", el: "Metal",
            tag: "Refined, sensitive and precise, with high standards you rarely say out loud.",
            traits: ["Elegant", "Exacting", "Sensitive"],
            bom: "You notice everything. Including what people don't say.",
            love: "In love you want beauty and respect, and you leave quietly when either one goes missing." },
          { hanja: "壬", name: "Im Water", nick: "The ocean", el: "Water",
            tag: "Big-hearted, restless, curious about everything, carrying more depth than people guess.",
            traits: ["Curious", "Generous", "Restless"],
            bom: "You hold more than you show. That's why nobody can read you.",
            love: "In love you need freedom and depth at once, and you leave when a bond turns into a cage." },
          { hanja: "癸", name: "Gye Water", nick: "The rain", el: "Water",
            tag: "Gentle, perceptive, imaginative, reaching people in ways they only notice later.",
            traits: ["Perceptive", "Gentle", "Dreamy"],
            bom: "You feel the weather in a room before anyone speaks.",
            love: "In love you read every signal and then talk yourself out of what you already know." }
        ];
var STRONGEST_TXT = [
          "Wood leads your chart. You grow, plan and start things. People feel your ambition before you say a word.",
          "Fire leads your chart. You light rooms, chase passion and get bored fast. Your charm is your superpower.",
          "Earth leads your chart. You hold everyone together. Reliable, grounded, the safe place for everyone else.",
          "Metal leads your chart. Sharp standards, clean lines, strong boundaries. You decide and you don't look back.",
          "Water leads your chart. Deep, intuitive and fluid. You read people like open books."
        ];
var MISSING_TXT = [
          "Missing Wood: you can stall on new beginnings. Remedy: green, plants, morning walks, saying yes to one new thing each week.",
          "Missing Fire: joy and visibility don't come easily. Remedy: red or coral accents, sunlight, dancing, letting people see you.",
          "Missing Earth: life can feel unsteady. Remedy: yellow and beige, routines, cooking at home, one place that's only yours.",
          "Missing Metal: boundaries are hard. Remedy: white and silver, decluttering, saying no without explaining.",
          "Missing Water: rest and intuition get ignored. Remedy: black and navy, water by your bed, journaling at night, slow mornings."
        ];
var ATTRACT_TXT = [
          "You keep falling for Metal types: cool, sharp, a little unreachable. They trim you into shape and you secretly like the challenge. Lesson: choose the one who's sharp with the world, not with you.",
          "You keep falling for Water types: mysterious, calm, hard to read. They cool your fire, and the steam is addictive. Lesson: mystery is fun, silence is not. Pick the one who answers.",
          "You keep falling for Wood types: ambitious dreamers who need a place to grow. You become their soil. Lesson: be a partner, not a project manager.",
          "You keep falling for Fire types: loud, warm, a bit chaotic. They melt your armor. Lesson: passion is not the same as safety. You deserve both.",
          "You keep falling for Earth types: stable, protective, slightly controlling. They give your waves a shore. Lesson: a shore, not a dam."
        ];
var VERDICTS = {
          they_feed: { t: "Yes. The thread is still warm.", p: "Their energy naturally flows toward you. People like this rarely disappear for good; they drift and return. If they come back, it will feel easy, not dramatic." },
          you_feed: { t: "Likely, when they need you.", p: "You were their sun. They will feel the cold without you, and they will notice. The real question isn't if they return, it's whether you want to keep giving." },
          same: { t: "Possibly, on your terms.", p: "Mirror souls bounce back to each other. But you'll repeat the same fight unless one of you changes the script. Let them come to you." },
          you_control: { t: "They'll circle back.", p: "You have the upper hand here, even if it doesn't feel like it. Expect a 'hey, random thought...' message. Decide before it arrives what you'll answer." },
          they_control: { t: "Not the way it was.", p: "This bond was magnetic but heavy. They might reappear, but the pattern would return with them. Yeon's advice: the thread is glowing so you can let it go gently." },
          none: { t: "The door is not closed.", p: "Without their birthday, Yeon reads your side of the thread: your chart still holds space for this person, but the next move belongs to them." }
        };
var SIGNS = [
          ["They follow a new account of yours", "They share something about growth or 'new chapters'", "A mutual friend suddenly invites you both"],
          ["Story views at 2 a.m.", "A long voice note out of nowhere", "Posting a song you used to share"],
          ["They ask about your family or your pet", "They return something you left behind", "A practical excuse to meet"],
          ["A short, perfectly worded text", "An apology without drama", "They congratulate you on something"],
          ["Dreams about them (yes, it counts)", "They like a very old photo", "Running into them 'by accident'"]
        ];
var SIGNS_NONE = ["A like on an old photo", "A 'random' message about something you shared", "Hearing their name three times in one week"];
var WINDOW = [[2, 3, 4], [5, 6, 7], [1, 4, 7, 10], [8, 9, 10], [11, 12, 1]];
var SPICY = [["Treats every relationship like a five-year plan. On date two.", "Rarely. You'd rather send a respectful, slightly too long goodbye text.", "You don't go back. You go up. Your ex finds out from your LinkedIn.", "You flirt by fixing their problems. Unprompted.", "Being right matters more than being close, and you know it."], ["Says \"I'm fine\" while rearranging their whole life around you.", "Slow fade. You water the chat less until it dies of thirst.", "Most likely to text \"haha it's been a while\". Vines grow back.", "Soft compliments, perfect timing, and you remember their coffee order.", "You adapt so well nobody knows what you actually want. Including you."], ["Love-bombs without meaning to. You just like people that much.", "Never on purpose. You just got distracted by six new plans.", "Stays friends with every ex, which their new partners hate.", "Loud, direct, impossible to miss. You text \"you're cute\" first.", "Needs an audience. Even for your sadness."], ["Remembers every word they said in 2019 and will quote it.", "No. You burn quietly, then send one devastating paragraph.", "Still checks their story. Every time. From a private account.", "Intense eye contact, deep questions, a playlist made just for them.", "Holds a grudge like a candle holds a flame. Steady, for years."], ["Won't change plans, opinions or restaurants. Ever.", "Never. You sit through the awkward talk like a mountain.", "Doesn't go back, but keeps their hoodie for six years.", "You show up. Consistently. That's it, and somehow it works.", "Stubborn silence as a love language."], ["Takes care of everyone so nobody ever takes care of you.", "Rarely. You keep replying to someone you're not into, out of guilt.", "Goes back because they \"need help moving\". Then stays for dinner.", "You feed them. Literally. Snacks are your love letter.", "Martyr mode. You keep score and never show the scoreboard."], ["Brutal honesty nobody asked for, then you call it loyalty.", "Clean cut. One message, no reply needed, door closed.", "Blocked, archived, deleted. You're not sad, you're efficient.", "Teasing that sounds like an insult and lands like a compliment.", "Treats feelings like a negotiation you have to win."], ["Notices the one typo in their love letter.", "Yes, elegantly. Read at 9:41. Never replied.", "Won't go back, but wants proof they're doing worse.", "Perfect outfit, perfect photo, perfectly unbothered. On purpose.", "Standards so high nobody passes, then you wonder why you're alone."], ["Disappears for three days to \"process\", comes back like nothing happened.", "The champion. Not cruel, just already in another ocean.", "Washes back every few months with a \"thinking of you\".", "Big ideas at 2 a.m. You make the world feel bigger.", "Commitment feels like a dam. You'd rather flood."], ["Reads hidden meaning in a \"k\" and spirals for an hour.", "You go quiet and hope they notice and ask.", "Still writes them letters you'll never send. Notes app, 2 a.m.", "Remembers tiny details and brings them up weeks later. Lethal.", "Absorbs everyone's mood, then blames yourself for the weather."]];
var SP_TABS = ["\ud83d\udea9 Red flag", "\ud83d\udc7b Do you ghost?", "\ud83d\udd19 Your ex", "\ud83d\ude0f How you flirt", "\u2620\ufe0f Toxic trait"];
var MATCH_TITLE = {
          they_feed: "They feed your soul", you_feed: "You light them up", same: "Mirror souls",
          you_control: "You lead, they follow", they_control: "A magnetic pull"
        };
var CHARMS = [
          { color: "Green", num: "3 and 8", dir: "East", season: "Spring", charm: "Jade leaf", day: "Thursday" },
          { color: "Red / coral", num: "2 and 7", dir: "South", season: "Summer", charm: "Red string", day: "Tuesday" },
          { color: "Yellow / beige", num: "5 and 10", dir: "Center / home", season: "Late summer", charm: "Amber stone", day: "Saturday" },
          { color: "White / silver", num: "4 and 9", dir: "West", season: "Autumn", charm: "Silver ring", day: "Friday" },
          { color: "Black / navy", num: "1 and 6", dir: "North", season: "Winter", charm: "Pearl", day: "Monday" }
        ];
var YEON_MSG = [
          "Grow toward the people who give you light. Stop bending for those who give you shade.",
          "You don't have to earn warmth. Let someone take care of your flame for once.",
          "You hold everyone. This year, let someone hold you.",
          "Your heart is not a fortress. Open one door, and see who walks in.",
          "Trust the feeling you keep explaining away. You already know."
        ];
var SLUGS=['gap-wood','eul-wood','byeong-fire','jeong-fire','mu-earth','gi-earth','gyeong-metal','sin-metal','im-water','gye-water'];
SOULS.forEach(function(s,i){s.slug=SLUGS[i];});
window.BY_DATA={SOULS:SOULS,SLUGS:SLUGS,STRONGEST_TXT:STRONGEST_TXT,MISSING_TXT:MISSING_TXT,ATTRACT_TXT:ATTRACT_TXT,VERDICTS:VERDICTS,SIGNS:SIGNS,SIGNS_NONE:SIGNS_NONE,WINDOW:WINDOW,SPICY:SPICY,SP_TABS:SP_TABS,MATCH_TITLE:MATCH_TITLE,CHARMS:CHARMS,YEON_MSG:YEON_MSG,EL_NAMES:['Wood','Fire','Earth','Metal','Water'],EL_COLOR:{Wood:'#6FA86B',Fire:'#C8564C',Earth:'#C9A45C',Metal:'#C3C7CE',Water:'#5E86B8'}};
})();
