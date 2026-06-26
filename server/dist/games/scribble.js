"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scribbleInactivityCheckers = exports.SCRIBBLE_WORDS = exports.LOCAL_CATEGORIES = exports.WORD_CATEGORIES = void 0;
exports.getScribbleSession = getScribbleSession;
exports.saveScribbleSession = saveScribbleSession;
exports.deleteScribbleSession = deleteScribbleSession;
exports.clearScribbleInactivityCheck = clearScribbleInactivityCheck;
exports.startScribbleInactivityCheck = startScribbleInactivityCheck;
exports.getScribbleMaskedState = getScribbleMaskedState;
exports.processScribbleMove = processScribbleMove;
exports.startScribbleDrawing = startScribbleDrawing;
exports.endScribbleRound = endScribbleRound;
exports.setupNextScribbleTurn = setupNextScribbleTurn;
exports.startScribbleWordSelectionTimer = startScribbleWordSelectionTimer;
const redis_1 = require("../utils/redis");
const logger_1 = require("../utils/logger");
const GAME_CACHE_TTL = 7200;
exports.WORD_CATEGORIES = [
    'Animals',
    'Objects',
    'Food',
    'Sports',
    'Technology',
    'Nature',
    'Vehicles',
    'Places',
    'Professions'
];
exports.LOCAL_CATEGORIES = {
    Animals: [
        "Dog", "Cat", "Lion", "Tiger", "Elephant", "Monkey", "Zebra", "Giraffe", "Bear", "Wolf",
        "Fox", "Deer", "Rabbit", "Squirrel", "Mouse", "Bat", "Parrot", "Eagle", "Owl", "Penguin",
        "Duck", "Chicken", "Frog", "Snake", "Lizard", "Turtle", "Shark", "Whale", "Dolphin", "Octopus",
        "Crab", "Snail", "Spider", "Bee", "Ant", "Butterfly", "Cow", "Horse", "Sheep", "Goat",
        "Pig", "Rooster", "Pigeon", "Kangaroo", "Koala", "Camel", "Hippo", "Rhino", "Panda", "Cheetah",
        "Leopard", "Donkey", "Mule", "Turkey", "Peacock", "Swan", "Goose", "Seagull", "Crow", "Raven",
        "Seal", "Walrus", "Otter", "Beaver", "Platypus", "Hedgehog", "Hamster", "Gerbil", "Flamingo", "Pelican",
        "Stork", "Vulture", "Falcon", "Hawk", "Cobra", "Viper", "Iguana", "Gecko", "Chameleon", "Tadpole",
        "Salmon", "Trout", "Goldfish", "Jellyfish", "Starfish", "Seahorse", "Eel", "Squid", "Clam", "Oyster",
        "Caterpillar", "Worm", "Dragonfly", "Ladybug", "Cricket", "Grasshopper", "Moth", "Wasp", "Hornet", "Mosquito"
    ],
    Objects: [
        "Table", "Chair", "Desk", "Bed", "Sofa", "Lamp", "Clock", "Watch", "Book", "Pen",
        "Pencil", "Paper", "Scissors", "Ruler", "Key", "Lock", "Door", "Window", "Wall", "Floor",
        "Mirror", "Comb", "Brush", "Soap", "Towel", "Toothbrush", "Cup", "Glass", "Plate", "Bowl",
        "Fork", "Spoon", "Knife", "Pan", "Pot", "Bottle", "Bag", "Box", "Basket", "Umbrella",
        "Hammer", "Nail", "Screw", "Saw", "Paintbrush", "Camera", "Phone", "Laptop", "Keyboard", "Mousepad",
        "Monitor", "Printer", "Speaker", "Headphones", "Microphone", "Guitar", "Piano", "Drum", "Violin", "Trumpet",
        "Flute", "Backpack", "Wallet", "Purse", "Suitcase", "Envelope", "Stamp", "Letter", "Card", "Coin",
        "Ring", "Necklace", "Bracelet", "Crown", "Shield", "Sword", "Bow", "Arrow", "Helmet", "Broom",
        "Mop", "Bucket", "Ladder", "Flashlight", "Battery", "Bulb", "Wire", "Plug", "Socket", "Wheel",
        "Tire", "Anchor", "Compass", "Map", "Globe", "Telescope", "Microscope", "Magnet", "Mirror"
    ],
    Food: [
        "Apple", "Banana", "Orange", "Grape", "Strawberry", "Blueberry", "Watermelon", "Peach", "Pear", "Cherry",
        "Pineapple", "Mango", "Lemon", "Lime", "Coconut", "Tomato", "Potato", "Carrot", "Onion", "Garlic",
        "Cucumber", "Lettuce", "Spinach", "Broccoli", "Cabbage", "Corn", "Peas", "Beans", "Mushroom", "Pepper",
        "Bread", "Butter", "Cheese", "Milk", "Yogurt", "Egg", "Meat", "Chicken", "Fish", "Shrimp",
        "Rice", "Pasta", "Noodle", "Soup", "Salad", "Pizza", "Burger", "Sandwich", "Taco", "Sushi",
        "Cake", "Cookie", "Pie", "Donut", "Cupcake", "Chocolate", "Candy", "Icecream", "Honey", "Jam",
        "Tea", "Coffee", "Juice", "Soda", "Water", "Wine", "Beer", "Salt", "Sugar", "Pepper",
        "Olive", "Pickle", "Mustard", "Ketchup", "Mayo", "Nuts", "Peanut", "Almond", "Walnut", "Cashew",
        "Waffle", "Pancake", "Toast", "Bacon", "Sausage", "Ham", "Steak", "Meatball", "Nugget", "Fry",
        "Popcorn", "Pretzel", "Chips", "Cracker", "Biscuit", "Oatmeal", "Cereal", "Flour", "Dough", "Yeast"
    ],
    Sports: [
        "Ball", "Bat", "Racket", "Net", "Goal", "Ring", "Glove", "Helmet", "Pad", "Shoes",
        "Jersey", "Shorts", "Socks", "Cap", "Whistle", "Card", "Flag", "Trophy", "Medal", "Ribbon",
        "Bicycle", "Skateboard", "Skates", "Ski", "Snowboard", "Surfboard", "Kayak", "Canoe", "Boat", "Paddle",
        "Dart", "Board", "Table", "Cue", "Chalk", "Target", "Bow", "Arrow", "Quiver", "Mat",
        "Rope", "Weight", "Barbell", "Dumbbell", "Bench", "Treadmill", "Bike", "Track", "Field", "Court",
        "Pool", "Lane", "Ring", "Cage", "Saddle", "Whip", "Boot", "Stirrup", "Horseshoe", "Puck",
        "Stick", "Skate", "Mask", "Pad", "Goalie", "Referee", "Umpire", "Coach", "Player", "Runner",
        "Jumper", "Thrower", "Pitcher", "Batter", "Bowler", "Keeper", "Defender", "Forward", "Striker", "Midfielder",
        "Shuttlecock", "Frisbee", "Boules", "Skittles", "Pins", "Clubs", "Tee", "Cart", "Bag", "Marker",
        "Stopwatch", "Timer", "Scoreboard", "Locker", "Bench", "Stand", "Arena", "Stadium", "Gym", "Ring"
    ],
    Technology: [
        "Computer", "Laptop", "Tablet", "Phone", "Screen", "Monitor", "Keyboard", "Mouse", "Printer", "Scanner",
        "Speaker", "Headphones", "Microphone", "Camera", "Webcam", "Projector", "Router", "Modem", "Switch", "Hub",
        "Server", "Drive", "Disk", "Tape", "Chip", "Processor", "Memory", "Board", "Card", "Cable",
        "Wire", "Plug", "Adapter", "Battery", "Charger", "Dock", "Stand", "Case", "Cover", "Screenprotector",
        "Stylus", "Pen", "Tablet", "Watch", "Band", "Glass", "Goggles", "Helmet", "Headset", "Sensor",
        "Robot", "Drone", "Car", "Engine", "Motor", "Generator", "Solarpanel", "Turbine", "Panel", "Meter",
        "Gauge", "Scope", "Laser", "Led", "Lamp", "Bulb", "Switch", "Relay", "Fuse", "Breaker",
        "Satellite", "Antenna", "Dish", "Receiver", "Transmitter", "Radio", "Tv", "Player", "Recorder", "Console",
        "Controller", "Joystick", "Gamepad", "Wheel", "Pedal", "Gear", "Lever", "Button", "Key", "Pad",
        "Chip", "Module", "Sensor", "Detector", "Alarm", "Siren", "Bell", "Buzzer", "Light", "Display"
    ],
    Nature: [
        "Tree", "Leaf", "Flower", "Grass", "Plant", "Seed", "Root", "Branch", "Trunk", "Bark",
        "Fruit", "Berry", "Nut", "Cone", "Fern", "Moss", "Mushroom", "Fungus", "Vine", "Bush",
        "Stone", "Rock", "Pebble", "Sand", "Dust", "Soil", "Dirt", "Mud", "Clay", "Mineral",
        "Mountain", "Hill", "Valley", "Cliff", "Cave", "Canyon", "Dune", "Island", "Peninsula", "Coast",
        "Beach", "Ocean", "Sea", "Lake", "River", "Stream", "Creek", "Pond", "Pool", "Spring",
        "Waterfall", "Geyser", "Glacier", "Iceberg", "Ice", "Snow", "Rain", "Cloud", "Fog", "Mist",
        "Wind", "Storm", "Thunder", "Lightning", "Fire", "Smoke", "Ash", "Lava", "Volcano", "Crater",
        "Sun", "Moon", "Star", "Planet", "Sky", "Horizon", "Sunrise", "Sunset", "Rainbow", "Aurora",
        "Coral", "Reef", "Shell", "Seaweed", "Wave", "Tide", "Current", "Forest", "Jungle", "Woods",
        "Swamp", "Marsh", "Desert", "Oasis", "Meadow", "Field", "Prairie", "Tundra", "Taiga", "Savanna"
    ],
    Vehicles: [
        "Car", "Truck", "Van", "Bus", "Coach", "Taxi", "Cab", "Lorry", "Tractor", "Trailer",
        "Train", "Tram", "Metro", "Subway", "Engine", "Carriage", "Wagon", "Cart", "Sled", "Sleigh",
        "Bicycle", "Tricycle", "Unicycle", "Scooter", "Motorcycle", "Moped", "Segway", "Skateboard", "Hoverboard", "Wheelchair",
        "Airplane", "Aeroplane", "Jet", "Helicopter", "Glider", "Balloon", "Airship", "Blimp", "Rocket", "Spaceship",
        "Satellite", "Capsule", "Shuttle", "Lander", "Rover", "Boat", "Ship", "Yacht", "Ferry", "Barge",
        "Submarine", "Canoe", "Kayak", "Raft", "Gondola", "Tugboat", "Lifeboat", "Speedboat", "Sailboat", "Catamaran",
        "Ambulance", "Fireengine", "Policecar", "Patrolcar", "Towtruck", "Garbagetruck", "Mailvan", "Forklift", "Crane", "Bulldozer",
        "Excavator", "Grader", "Roller", "Paver", "Dumper", "Tanker", "Mixer", "Sweeper", "Plough", "Harvester",
        "Chariot", "Carriage", "Buggy", "Rig", "Cabriolet", "Coupe", "Sedan", "Hatchback", "Limousine", "Jeep",
        "Cruiser", "Tank", "Carrier", "Destroyer", "Frigate", "Sub", "Clipper", "Galley", "Junk", "Dhow"
    ],
    Places: [
        "House", "Home", "Building", "Tower", "Castle", "Palace", "Temple", "Church", "Mosque", "Shrine",
        "School", "College", "University", "Library", "Museum", "Gallery", "Theatre", "Cinema", "Stadium", "Arena",
        "Gym", "Pool", "Park", "Garden", "Zoo", "Aquarium", "Hospital", "Clinic", "Pharmacy", "Surgery",
        "Office", "Factory", "Workshop", "Studio", "Lab", "Store", "Shop", "Market", "Mall", "Supermarket",
        "Bank", "Hotel", "Motel", "Hostel", "Inn", "Pub", "Bar", "Cafe", "Restaurant", "Diner",
        "Station", "Airport", "Port", "Harbour", "Terminal", "Stop", "Shelter", "Bridge", "Tunnel", "Dam",
        "Road", "Street", "Path", "Lane", "Track", "Highway", "Freeway", "Alley", "Square", "Plaza",
        "City", "Town", "Village", "Hamlet", "Suburb", "Country", "State", "Continent", "Island", "Peninsula",
        "Forest", "Jungle", "Desert", "Oasis", "Farm", "Vineyard", "Orchard", "Ranch", "Mine", "Quarry",
        "Camp", "Fort", "Base", "Station", "Post", "Office", "Court", "Prison", "Jail", "Police"
    ],
    Professions: [
        "Doctor", "Nurse", "Surgeon", "Dentist", "Chemist", "Scientist", "Teacher", "Professor", "Lecturer", "Tutor",
        "Engineer", "Architect", "Builder", "Carpenter", "Mason", "Plumber", "Electrician", "Painter", "Decorator", "Plasterer",
        "Welder", "Mechanic", "Technician", "Programmer", "Developer", "Analyst", "Designer", "Artist", "Sculptor", "Photographer",
        "Writer", "Author", "Poet", "Journalist", "Reporter", "Editor", "Publisher", "Printer", "Actor", "Singer",
        "Dancer", "Musician", "Composer", "Conductor", "Director", "Producer", "Manager", "Director", "Executive", "Secretary",
        "Clerk", "Assistant", "Receptionist", "Agent", "Broker", "Dealer", "Seller", "Trader", "Merchant", "Grocer",
        "Baker", "Butcher", "Chef", "Cook", "Waiter", "Waitress", "Bartender", "Barista", "Host", "Hostess",
        "Driver", "Pilot", "Captain", "Sailor", "Crew", "Guard", "Officer", "Soldier", "Marine", "Airman",
        "Police", "Detective", "Firefighter", "Paramedic", "Warden", "Ranger", "Farmer", "Gardener", "Fisher", "Hunter",
        "Lawyer", "Judge", "Juror", "Clerk", "Usher", "Bailiff", "Notary", "Accountant", "Auditor", "Cashier"
    ]
};
exports.SCRIBBLE_WORDS = exports.LOCAL_CATEGORIES.Animals;
/**
 * Generates word lists via the Groq API
 */
async function generateGroqWords(category) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error('GROQ_API_KEY is not defined');
    }
    const systemPrompt = `You are a helpful assistant that generates word lists for a drawing game. You must respond in strict JSON format. The JSON object must contain exactly two keys: 'category' and 'words'. The 'category' key must match the category name provided. The 'words' key must contain an array of exactly 100 unique, simple, easily drawable English nouns related to that category. Do not include verbs, adjectives, complex/abstract words, or multi-word phrases. Each word must be a single, concrete, easily drawable noun (e.g., 'dog', 'apple', 'car', 'tree', 'sun', 'chair').`;
    const userPrompt = `Generate exactly 100 unique, easily drawable nouns for the category: '${category}'. Keep all words in Capital Case (e.g., 'Apple'). Keep the output format strictly JSON.`;
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7
        })
    });
    if (!response.ok) {
        throw new Error(`Groq API returned status ${response.status}: ${await response.text()}`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('Groq API response content is empty');
    }
    const parsed = JSON.parse(content);
    if (!parsed.words || !Array.isArray(parsed.words)) {
        throw new Error('Invalid JSON format from Groq API response');
    }
    const words = parsed.words
        .map((w) => String(w).trim())
        .filter((w) => w.length > 0 && /^[A-Za-z]+$/.test(w));
    return words;
}
/**
 * Background worker to fetch words from Groq and append to queue without blocking
 */
async function fetchAndAppendWords(roomCode, roomId, category, prisma) {
    try {
        logger_1.logger.info(`[Scribble Groq] Initiating background word generation for room ${roomCode}, category ${category}`);
        const groqWords = await generateGroqWords(category);
        const currentGameState = await getScribbleSession(roomCode, roomId, prisma);
        if (!currentGameState)
            return;
        const unusedWords = currentGameState.unusedWords || [];
        const usedWords = currentGameState.usedWords || [];
        const addedWords = [];
        for (const word of groqWords) {
            const cleanWord = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            if (!unusedWords.includes(cleanWord) && !usedWords.includes(cleanWord)) {
                addedWords.push(cleanWord);
            }
        }
        if (addedWords.length > 0) {
            currentGameState.unusedWords = [...unusedWords, ...addedWords];
            logger_1.logger.info(`[Scribble Groq] Successfully appended ${addedWords.length} new Groq words to room ${roomCode}`);
            await saveScribbleSession(roomCode, currentGameState);
            await prisma.multiplayerGameSession.update({
                where: { roomId },
                data: { gameState: currentGameState }
            });
        }
    }
    catch (err) {
        logger_1.logger.error(`[Scribble Groq] Failed to fetch background words for room ${roomCode}: ${err.message}`);
    }
}
/**
 * Pops 4 words from the unusedWords queue and moves them to usedWords
 */
function popWordsFromQueue(state) {
    if (!state.usedWords)
        state.usedWords = [];
    if (!state.unusedWords || state.unusedWords.length < 4) {
        const category = state.category || 'Animals';
        const fallbackList = exports.LOCAL_CATEGORIES[category] || exports.LOCAL_CATEGORIES.Animals;
        const filtered = fallbackList.filter(w => !state.usedWords.includes(w));
        const refillList = filtered.length >= 4 ? filtered : fallbackList;
        state.unusedWords = [...refillList].sort(() => 0.5 - Math.random());
    }
    const choices = state.unusedWords.splice(0, 4);
    state.usedWords.push(...choices);
    return choices;
}
async function getScribbleSession(roomCode, roomId, prisma) {
    const redisKey = `game:scribble:${roomCode}`;
    if (redis_1.redisClient.isReady) {
        try {
            const cached = await redis_1.redisClient.get(redisKey);
            if (cached) {
                return JSON.parse(cached);
            }
        }
        catch (err) {
            console.error('Failed to get scribble session from Redis:', err);
        }
    }
    const dbSession = await prisma.multiplayerGameSession.findUnique({
        where: { roomId }
    });
    if (dbSession) {
        const parsedState = typeof dbSession.gameState === 'string'
            ? JSON.parse(dbSession.gameState)
            : dbSession.gameState;
        await saveScribbleSession(roomCode, parsedState);
        return parsedState;
    }
    return null;
}
async function saveScribbleSession(roomCode, state) {
    const redisKey = `game:scribble:${roomCode}`;
    if (redis_1.redisClient.isReady) {
        try {
            await redis_1.redisClient.set(redisKey, JSON.stringify(state), { EX: GAME_CACHE_TTL });
        }
        catch (err) {
            console.error('Failed to save scribble session to Redis:', err);
        }
    }
}
async function deleteScribbleSession(roomCode) {
    const redisKey = `game:scribble:${roomCode}`;
    if (redis_1.redisClient.isReady) {
        try {
            await redis_1.redisClient.del(redisKey);
        }
        catch (err) {
            console.error('Failed to delete scribble session from Redis:', err);
        }
    }
}
function persistSnapshot(roomId, state, status, winnerId, prisma) {
    const now = new Date();
    prisma.multiplayerGameSession.update({
        where: { roomId },
        data: {
            status,
            winnerId,
            gameState: state,
            lastActivityAt: now,
            updatedAt: now
        }
    }).then(() => {
        logger_1.logger.info(`[SNAPSHOT SUCCESS] Persisted scribble game state to PostgreSQL for roomId=${roomId}`);
    }).catch((err) => {
        (0, logger_1.logError)(err, { roomId, context: 'scribble-snapshot' });
    });
}
// Global active interval checkers for scribble games
exports.scribbleInactivityCheckers = new Map();
function clearScribbleInactivityCheck(roomCode) {
    const interval = exports.scribbleInactivityCheckers.get(roomCode);
    if (interval) {
        clearInterval(interval);
        exports.scribbleInactivityCheckers.delete(roomCode);
    }
}
function startScribbleInactivityCheck(roomCode, io, prisma) {
    clearScribbleInactivityCheck(roomCode);
    const interval = setInterval(async () => {
        try {
            const room = await prisma.multiplayerRoom.findUnique({
                where: { roomCode },
                include: { players: { include: { profile: true } } }
            });
            if (!room || room.status !== 'PLAYING') {
                clearScribbleInactivityCheck(roomCode);
                return;
            }
            const state = await getScribbleSession(roomCode, room.id, prisma);
            if (!state || state.stage !== 'DRAWING') {
                clearScribbleInactivityCheck(roomCode);
                return;
            }
            // Emit periodic state updates to keep clients synced with current hints and timer
            for (const player of room.players) {
                const pSocketId = index_1.userSockets.get(player.userId);
                if (pSocketId) {
                    const maskedState = getScribbleMaskedState(state, player.userId);
                    io.to(pSocketId).emit('game-update', {
                        gameState: maskedState,
                        gameFinished: false,
                        winnerId: null
                    });
                }
            }
            const elapsedInactivity = Date.now() - state.lastDrawAt;
            if (elapsedInactivity >= 15000) {
                clearScribbleInactivityCheck(roomCode);
                const getUsername = (uid) => room.players.find((p) => p.userId === uid)?.profile?.username || 'Drawer';
                state.commentary.unshift(`⚠️ ${getUsername(state.drawerId)} was skipped due to drawing inactivity!`);
                await endScribbleRound(roomCode, room.id, state, room.players, prisma, io, true);
            }
            else if (elapsedInactivity >= 10000) {
                io.to(`game:${roomCode}`).emit('scribble-afk-warning', { drawerId: state.drawerId });
            }
        }
        catch (err) {
            console.error('Inactivity check error:', err);
        }
    }, 1000);
    exports.scribbleInactivityCheckers.set(roomCode, interval);
}
function getScribbleMaskedState(state, userId) {
    if (!state)
        return null;
    if (state.drawerId === userId || state.stage === 'ROUND_SUMMARY' || state.stage === 'FINISHED') {
        return state;
    }
    if (state.stage === 'DRAWING' && state.selectedWord) {
        const word = state.selectedWord.toUpperCase();
        const elapsedMs = Date.now() - state.timerStart;
        const elapsedPercent = elapsedMs / (state.timerDuration * 1000);
        let revealPct = 0;
        if (elapsedPercent >= 0.75) {
            revealPct = 0.50;
        }
        else if (elapsedPercent >= 0.50) {
            revealPct = 0.35;
        }
        else if (elapsedPercent >= 0.25) {
            revealPct = 0.20;
        }
        else {
            revealPct = 0.00;
        }
        let cappedHintsCount = 0;
        if (revealPct > 0) {
            cappedHintsCount = Math.max(1, Math.floor(word.length * revealPct));
            const maxPossibleReveal = Math.floor(word.length / 2);
            if (cappedHintsCount > maxPossibleReveal) {
                cappedHintsCount = maxPossibleReveal;
            }
        }
        // Deterministic shuffle of indices to reveal based on word seed
        const indices = Array.from({ length: word.length }, (_, i) => i);
        let seed = word.length;
        for (let i = indices.length - 1; i > 0; i--) {
            seed = (seed * 9301 + 49297) % 233280;
            const j = Math.floor((seed / 233280) * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        const revealedIndices = indices.slice(0, cappedHintsCount);
        let hintString = '';
        for (let i = 0; i < word.length; i++) {
            if (revealedIndices.includes(i)) {
                hintString += word[i] + ' ';
            }
            else {
                hintString += '_ ';
            }
        }
        hintString = hintString.trim();
        return {
            ...state,
            selectedWord: undefined, // Mask the word
            hintString
        };
    }
    return state;
}
async function processScribbleMove(roomCode, roomId, userId, move, players, prisma, io) {
    const currentGameState = await getScribbleSession(roomCode, roomId, prisma);
    if (!currentGameState) {
        throw new Error('Scribble session not found');
    }
    const { type } = move;
    let gameFinished = false;
    let winnerId = null;
    if (type === 'settings') {
        if (currentGameState.stage !== 'LOBBY_SETTINGS') {
            throw new Error('Game settings already initialized');
        }
        if (currentGameState.hostUserId !== userId) {
            throw new Error('Only the host can configure the match');
        }
        const duration = move.timerDuration || 45;
        if (duration !== 15 && duration !== 30 && duration !== 45 && duration !== 60) {
            throw new Error('Invalid timer duration');
        }
        currentGameState.timerDuration = duration;
        // Initialize strict player rotation array
        currentGameState.drawerRotation = players.map(p => p.userId);
        // Find the first connected player to start drawing
        let firstConnectedIndex = 0;
        while (firstConnectedIndex < currentGameState.drawerRotation.length) {
            const uid = currentGameState.drawerRotation[firstConnectedIndex];
            const isConnected = players.some((p) => p.userId === uid && p.status !== 'DISCONNECTED' && p.status !== 'LEFT');
            if (isConnected) {
                break;
            }
            firstConnectedIndex++;
        }
        currentGameState.drawerIndex = firstConnectedIndex >= currentGameState.drawerRotation.length ? 0 : firstConnectedIndex;
        currentGameState.drawerId = currentGameState.drawerRotation[currentGameState.drawerIndex];
        currentGameState.stage = 'WORD_SELECTION';
        const category = exports.WORD_CATEGORIES[Math.floor(Math.random() * exports.WORD_CATEGORIES.length)];
        currentGameState.category = category;
        const localWords = exports.LOCAL_CATEGORIES[category] || exports.LOCAL_CATEGORIES.Animals;
        currentGameState.unusedWords = [...localWords].sort(() => 0.5 - Math.random());
        currentGameState.usedWords = [];
        currentGameState.wordsToSelect = popWordsFromQueue(currentGameState);
        fetchAndAppendWords(roomCode, roomId, category, prisma).catch(err => {
            logger_1.logger.error(`[Scribble Groq] Start prefetch background error: ${err.message}`);
        });
        currentGameState.timerStart = Date.now();
        currentGameState.timerRemaining = 15; // 15 seconds to pick word
        await saveScribbleSession(roomCode, currentGameState);
        persistSnapshot(roomId, currentGameState, 'PLAYING', null, prisma);
        // Schedule word selection timeout
        startScribbleWordSelectionTimer(roomCode, io, prisma);
    }
    else if (type === 'select-word') {
        if (currentGameState.stage !== 'WORD_SELECTION') {
            throw new Error('Not currently selecting a word');
        }
        if (currentGameState.drawerId !== userId) {
            throw new Error('Only the current drawer can select the word');
        }
        const word = move.word || '';
        if (!currentGameState.wordsToSelect.includes(word)) {
            throw new Error('Invalid word selection');
        }
        await startScribbleDrawing(roomCode, roomId, currentGameState, word, players, prisma, io);
    }
    else if (type === 'draw') {
        if (currentGameState.stage !== 'DRAWING') {
            throw new Error('Not in drawing stage');
        }
        if (currentGameState.drawerId !== userId) {
            throw new Error('Only the drawer can draw');
        }
        currentGameState.canvasLines = move.lines || [];
        currentGameState.lastDrawAt = Date.now();
        await saveScribbleSession(roomCode, currentGameState);
    }
    else if (type === 'clear') {
        if (currentGameState.stage !== 'DRAWING') {
            throw new Error('Not in drawing stage');
        }
        if (currentGameState.drawerId !== userId) {
            throw new Error('Only the drawer can clear the canvas');
        }
        currentGameState.canvasLines = [];
        currentGameState.lastDrawAt = Date.now();
        await saveScribbleSession(roomCode, currentGameState);
    }
    else if (type === 'guess') {
        if (currentGameState.stage !== 'DRAWING') {
            throw new Error('Guesses are only allowed during drawing');
        }
        if (currentGameState.drawerId === userId) {
            throw new Error('Drawer cannot guess their own word');
        }
        if (currentGameState.guessedPlayers.includes(userId)) {
            throw new Error('You already guessed correctly');
        }
        const guess = (move.guess || '').trim().toLowerCase();
        const targetWord = currentGameState.selectedWord.toLowerCase();
        const getUsername = (uid) => players.find((p) => p.userId === uid)?.username || 'Player';
        if (guess === targetWord) {
            // Correct Guess!
            currentGameState.guessedPlayers.push(userId);
            const elapsedMs = Date.now() - currentGameState.timerStart;
            const duration = currentGameState.timerDuration;
            let points = 40;
            if (elapsedMs < (duration * 1000) / 3) {
                points = 100;
            }
            else if (elapsedMs < (duration * 1000 * 2) / 3) {
                points = 70;
            }
            // First Correct Guess Bonus (+25 points)
            if (!currentGameState.firstGuessed) {
                points += 25;
                currentGameState.firstGuessed = true;
                currentGameState.commentary.unshift(`⭐ ${getUsername(userId)} guessed FIRST! (+25 pts)`);
            }
            currentGameState.roundScores[userId] = points;
            currentGameState.playerScores[userId] = (currentGameState.playerScores[userId] || 0) + points;
            // Drawer Bonus (+20 points per guesser)
            const drawerId = currentGameState.drawerId;
            currentGameState.roundScores[drawerId] = (currentGameState.roundScores[drawerId] || 0) + 20;
            currentGameState.playerScores[drawerId] = (currentGameState.playerScores[drawerId] || 0) + 20;
            currentGameState.commentary.unshift(`✅ ${getUsername(userId)} guessed correctly! (+${points} pts)`);
            // Check if all active players (except drawer) have guessed correctly
            const spectators = players.filter((p) => p.userId !== drawerId);
            const allGuessed = spectators.every((p) => currentGameState.guessedPlayers.includes(p.userId));
            if (allGuessed) {
                clearScribbleInactivityCheck(roomCode);
                await endScribbleRound(roomCode, roomId, currentGameState, players, prisma, io);
            }
            else {
                await saveScribbleSession(roomCode, currentGameState);
                persistSnapshot(roomId, currentGameState, 'PLAYING', null, prisma);
            }
        }
        else {
            // Incorrect guess - treat as chat message or log
            currentGameState.commentary.unshift(`💬 ${getUsername(userId)}: ${move.guess}`);
            await saveScribbleSession(roomCode, currentGameState);
        }
    }
    return { state: currentGameState, gameFinished, winnerId };
}
async function startScribbleDrawing(roomCode, roomId, state, word, players, prisma, io) {
    (0, index_1.clearTurnTimer)(roomCode);
    state.selectedWord = word;
    state.stage = 'DRAWING';
    state.timerStart = Date.now();
    state.guessedPlayers = [];
    state.roundScores = players.reduce((acc, p) => ({ ...acc, [p.userId]: 0 }), {});
    state.firstGuessed = false;
    state.canvasLines = [];
    state.lastDrawAt = Date.now();
    const getUsername = (uid) => players.find((p) => p.userId === uid)?.username || 'Drawer';
    state.commentary.unshift(`🎨 Round started! ${getUsername(state.drawerId)} is drawing...`);
    await saveScribbleSession(roomCode, state);
    persistSnapshot(roomId, state, 'PLAYING', null, prisma);
    // Start activity monitoring
    startScribbleInactivityCheck(roomCode, io, prisma);
    // Schedule round end drawing timer
    const duration = state.timerDuration;
    const timeout = setTimeout(async () => {
        const queue = (0, queue_1.getRoomQueue)(roomCode);
        queue.add(async () => {
            try {
                const room = await prisma.multiplayerRoom.findUnique({
                    where: { roomCode },
                    include: { players: { include: { profile: true } } }
                });
                if (!room)
                    return;
                const session = await prisma.multiplayerGameSession.findUnique({ where: { roomId: room.id } });
                if (!session || session.status !== 'PLAYING')
                    return;
                const freshState = await getScribbleSession(roomCode, room.id, prisma);
                if (freshState && freshState.stage === 'DRAWING') {
                    clearScribbleInactivityCheck(roomCode);
                    await endScribbleRound(roomCode, room.id, freshState, room.players, prisma, io);
                }
            }
            catch (err) {
                console.error('Drawing round timer expired error:', err);
            }
        });
    }, duration * 1000);
    index_1.roomTurnTimeouts.set(roomCode, timeout);
    // Emit player-specific masked states
    for (const player of players) {
        const pSocketId = index_1.userSockets.get(player.userId);
        if (pSocketId) {
            const maskedState = getScribbleMaskedState(state, player.userId);
            io.to(pSocketId).emit('game-update', {
                gameState: maskedState,
                gameFinished: false,
                winnerId: null
            });
        }
    }
}
async function endScribbleRound(roomCode, roomId, state, players, prisma, io, isSkipped = false) {
    (0, index_1.clearTurnTimer)(roomCode);
    clearScribbleInactivityCheck(roomCode);
    state.stage = 'ROUND_SUMMARY';
    state.commentary.unshift(`🏁 Round Over! The word was: "${state.selectedWord.toUpperCase()}"`);
    await saveScribbleSession(roomCode, state);
    persistSnapshot(roomId, state, 'PLAYING', null, prisma);
    // Notify clients (reveal full word to everyone in round summary)
    io.to(`game:${roomCode}`).emit('game-update', {
        gameState: state,
        gameFinished: false,
        winnerId: null
    });
    // Start 8-second Round Summary timer
    const summaryTimeout = setTimeout(() => {
        const queue = (0, queue_1.getRoomQueue)(roomCode);
        queue.add(async () => {
            try {
                const room = await prisma.multiplayerRoom.findUnique({
                    where: { roomCode },
                    include: { players: { include: { profile: true } } }
                });
                if (!room)
                    return;
                const session = await prisma.multiplayerGameSession.findUnique({ where: { roomId: room.id } });
                if (!session || session.status !== 'PLAYING')
                    return;
                const freshState = await getScribbleSession(roomCode, room.id, prisma);
                if (freshState && freshState.stage === 'ROUND_SUMMARY') {
                    await setupNextScribbleTurn(roomCode, room.id, freshState, room.players, prisma, io);
                }
            }
            catch (err) {
                console.error('Round summary transition error:', err);
            }
        });
    }, 8000);
    index_1.roomTurnTimeouts.set(roomCode, summaryTimeout);
}
async function setupNextScribbleTurn(roomCode, roomId, state, players, prisma, io) {
    if (!state.drawerRotation) {
        state.drawerRotation = players.map(p => p.userId);
    }
    state.drawerIndex++;
    if (state.drawerIndex >= state.drawerRotation.length) {
        state.drawerIndex = 0;
        state.round++;
    }
    // Scan for the next connected player in rotation, counting skipped turns
    let searchAttempts = 0;
    const rotationLength = state.drawerRotation.length;
    let foundConnected = false;
    while (searchAttempts < rotationLength && state.round <= state.maxRounds) {
        const potentialDrawerId = state.drawerRotation[state.drawerIndex];
        const isConnected = players.some((p) => p.userId === potentialDrawerId && p.status !== 'DISCONNECTED' && p.status !== 'LEFT');
        if (isConnected) {
            state.drawerId = potentialDrawerId;
            foundConnected = true;
            break;
        }
        else {
            state.commentary.unshift(`⚠️ Skipped turn for disconnected player.`);
            state.drawerIndex++;
            searchAttempts++;
            if (state.drawerIndex >= state.drawerRotation.length) {
                state.drawerIndex = 0;
                state.round++;
            }
        }
    }
    // Check if final round ended
    if (state.round > state.maxRounds) {
        // Cap round counter at maxRounds on finish
        state.round = state.maxRounds;
        state.stage = 'FINISHED';
        // Find winner
        let maxScore = -1;
        let winnerId = null;
        Object.keys(state.playerScores).forEach(uid => {
            const s = state.playerScores[uid];
            if (s > maxScore) {
                maxScore = s;
                winnerId = uid;
            }
            else if (s === maxScore) {
                winnerId = 'DRAW';
            }
        });
        state.commentary.unshift(`🏆 Match finished! Leaderboard is final.`);
        await saveScribbleSession(roomCode, state);
        persistSnapshot(roomId, state, 'FINISHED', winnerId, prisma);
        // Distribute multiplayer rewards
        await handleMultiplayerCompletionRewards(roomId, state, winnerId, players, prisma);
        await deleteScribbleSession(roomCode);
        io.to(`game:${roomCode}`).emit('game-update', {
            gameState: state,
            gameFinished: true,
            winnerId
        });
    }
    else {
        // Word selection for next drawer
        state.stage = 'WORD_SELECTION';
        state.wordsToSelect = popWordsFromQueue(state);
        state.selectedWord = '';
        if (state.unusedWords.length < 20) {
            fetchAndAppendWords(roomCode, roomId, state.category, prisma).catch(err => {
                logger_1.logger.error(`[Scribble Groq] Turn prefetch background error: ${err.message}`);
            });
        }
        state.timerStart = Date.now();
        state.timerRemaining = 15;
        state.canvasLines = [];
        await saveScribbleSession(roomCode, state);
        persistSnapshot(roomId, state, 'PLAYING', null, prisma);
        // Schedule Word Selection timer (15s)
        startScribbleWordSelectionTimer(roomCode, io, prisma);
        // Emit player-specific masked states for word selection stage
        for (const player of players) {
            const pSocketId = index_1.userSockets.get(player.userId);
            if (pSocketId) {
                const maskedState = getScribbleMaskedState(state, player.userId);
                io.to(pSocketId).emit('game-update', {
                    gameState: maskedState,
                    gameFinished: false,
                    winnerId: null
                });
            }
        }
    }
}
function startScribbleWordSelectionTimer(roomCode, io, prisma) {
    (0, index_1.clearTurnTimer)(roomCode);
    const timeout = setTimeout(() => {
        const queue = (0, queue_1.getRoomQueue)(roomCode);
        queue.add(async () => {
            try {
                const room = await prisma.multiplayerRoom.findUnique({
                    where: { roomCode },
                    include: { players: { include: { profile: true } } }
                });
                if (!room)
                    return;
                const session = await prisma.multiplayerGameSession.findUnique({ where: { roomId: room.id } });
                if (!session || session.status !== 'PLAYING')
                    return;
                const state = await getScribbleSession(roomCode, room.id, prisma);
                if (state && state.stage === 'WORD_SELECTION') {
                    // Drawer did not pick word in 15 seconds! Select first word automatically
                    const autoWord = state.wordsToSelect[0] || 'Apple';
                    state.commentary.unshift(`⏰ Time out! Word auto-chosen for drawer.`);
                    await startScribbleDrawing(roomCode, room.id, state, autoWord, room.players, prisma, io);
                }
            }
            catch (err) {
                console.error('Word selection timer expired error:', err);
            }
        });
    }, 15000);
    index_1.roomTurnTimeouts.set(roomCode, timeout);
}
async function handleMultiplayerCompletionRewards(roomId, state, winnerId, players, prisma) {
    try {
        const game = await prisma.game.findUnique({ where: { slug: 'scribble' } });
        if (!game)
            return;
        // Order players by scores
        const sortedPlayers = [...players].sort((a, b) => (state.playerScores[b.userId] || 0) - (state.playerScores[a.userId] || 0));
        for (let i = 0; i < sortedPlayers.length; i++) {
            const p = sortedPlayers[i];
            // Determine rewards based on rank
            let xp = 30;
            let coins = 5;
            if (i === 0) {
                xp = 150;
                coins = 30;
            }
            else if (i === 1) {
                xp = 100;
                coins = 20;
            }
            else if (i === 2) {
                xp = 75;
                coins = 15;
            }
            if (p.profile) {
                await prisma.profile.update({
                    where: { id: p.profile.id },
                    data: {
                        xp: { increment: xp },
                        coins: { increment: coins }
                    }
                });
            }
        }
    }
    catch (err) {
        logger_1.logger.error(err, 'Failed to distribute scribble rewards');
    }
}
// Reuse timers/queues references from index.ts by proxying
const index_1 = require("../index");
const queue_1 = require("../utils/queue");
