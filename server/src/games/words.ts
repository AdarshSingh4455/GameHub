export const WORD_CATEGORIES = [
  'Animals',
  'Objects',
  'Food',
  'Sports',
  'Technology',
  'Nature',
  'Vehicles',
  'Places',
  'Professions'
]

export const LOCAL_CATEGORIES: Record<string, string[]> = {
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
    "Beach", "Ocean", "Sea", "Lake", "River", "Stream", "Creek", "Pond", "Pond", "Spring",
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
}

export const WORD_ALIASES: Record<string, string[]> = {
  "Tiger": ["stripes", "cat", "feline", "predator", "jungle"],
  "Cat": ["kitten", "meow", "feline", "pet"],
  "Dog": ["puppy", "bark", "canine", "pet"],
  "Lion": ["roar", "king", "feline", "mane"],
  "Elephant": ["trunk", "tusks", "jumbo", "mammoth"],
  "Pizza": ["slice", "cheese", "crust", "pepperoni", "dough"],
  "Apple": ["fruit", "pie", "cider", "orchard"],
  "Banana": ["yellow", "peel", "fruit", "monkey"]
}
