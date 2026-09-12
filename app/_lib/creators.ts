export type CreatorStatus = "booking" | "soon";

export type Seat = {
  id: string;
  name: string;
  price: string;
  unitAmount: number;
  format: string;
  host: string;
  description: string;
  stripePriceEnv: string;
};

export type CreatorAvailabilityRule = {
  bufferMinutes?: number | null;
  dayOfWeek: number;
  enabled?: boolean;
  endTime: string;
  maxBookingsPerDay?: number | null;
  maxBookingsPerWeek?: number | null;
  minNoticeMinutes?: number | null;
  startTime: string;
  timezone: string;
};

export type CreatorMediaItem = {
  alt?: string;
  href?: string;
  id: string;
  kind: "photo" | "video";
  source: string;
  title: string;
};

export type Creator = {
  id: string;
  slug: string;
  name: string;
  instagramHandle?: string;
  tiktokHandle?: string;
  title: string;
  category: string;
  status: CreatorStatus;
  offer: string;
  price: string;
  length: string;
  note: string;
  image: string | null;
  objectPosition: string;
  profileImagePositionX?: number | null;
  profileImagePositionY?: number | null;
  profileImageZoom?: number | null;
  accent: string;
  mediaItems?: CreatorMediaItem[];
  instagramUrl?: string;
  tiktokUrl?: string;
  location?: string;
  availabilityRules?: CreatorAvailabilityRule[];
  profile?: {
    announcement: string;
    intro: string;
    about: string[];
    helpHeading: string;
    helpItems: string[];
    whyTitle: string;
    whyBody: string;
    waitlistSubject: string;
  };
  seats: Seat[];
};

export const creators: Creator[] = [
  {
    id: "ella",
    slug: "ella",
    name: "Ella McLane",
    instagramHandle: "@ellamclane2",
    tiktokHandle: "@ellamclane",
    title: "College lifestyle, outfits, and ShopMy picks",
    category: "Style & Beauty",
    status: "booking",
    offer: "Outfit Second Opinion",
    price: "$50",
    length: "15 minutes",
    note: "She helps people choose outfits, links, and little upgrades that feel easy to wear.",
    image: "/ella-profile.jpg",
    objectPosition: "50% 50%",
    accent: "style",
    instagramUrl: "https://www.instagram.com/ellamclane2/",
    tiktokUrl: "https://www.tiktok.com/@ellamclane",
    mediaItems: [
      {
        alt: "Ella McLane in a sundress near the coast",
        href: "https://www.tiktok.com/@ellamclane/video/7665329691254951198",
        id: "ella-reference-sundress",
        kind: "photo",
        source: "/ella-reference-sundress.jpg",
        title: "Sundress styling",
      },
      {
        alt: "Ella McLane street style outfit reference",
        href: "https://www.tiktok.com/@ellamclane/video/7661987130444418334",
        id: "ella-reference-street-style",
        kind: "photo",
        source: "/ella-reference-street-style.jpg",
        title: "Everyday outfit polish",
      },
      {
        alt: "Ella McLane coastal outfit inspiration",
        href: "https://www.tiktok.com/@ellamclane/video/7657164268663557407",
        id: "ella-reference-coast",
        kind: "photo",
        source: "/ella-reference-coast.jpg",
        title: "Coastal classics",
      },
    ],
    seats: [
      {
        id: "ella-15",
        name: "15 minutes",
        price: "$50",
        unitAmount: 5000,
        format: "Private video call",
        host: "Ella McLane",
        description:
          "A focused second opinion before you buy one piece, pack one outfit, or post one look.",
        stripePriceEnv: "STRIPE_PRICE_ELLA_15",
      },
      {
        id: "ella-30",
        name: "30 minutes",
        price: "$60",
        unitAmount: 6000,
        format: "Private video call",
        host: "Ella McLane",
        description:
          "More room to talk through a trip, event, closet gap, or small set of shopping links.",
        stripePriceEnv: "STRIPE_PRICE_ELLA_30",
      },
    ],
  },
  {
    id: "montecito-style",
    slug: "montecito-style",
    name: "Montecito Style",
    tiktokHandle: "@montecitostyle",
    title: "Real estate, interiors, and coastal design taste",
    category: "Home Interiors",
    status: "soon",
    offer: "Room Point of View",
    price: "Soon",
    length: "20 minutes",
    note: "A polished design seat for making a room, listing, or rental feel more intentional.",
    image: "/montecito-style-avatar.jpg",
    objectPosition: "50% 50%",
    accent: "home",
    tiktokUrl: "https://www.tiktok.com/@montecitostyle",
    profile: {
      announcement: "Creator concept profile for Montecito Style",
      intro:
        "Montecito Style has a refined eye for real estate, interiors, and coastal design. This seat would be for people who want a room to feel more considered without making it precious.",
      about: [
        "The account sits between dream-house browsing and usable design instinct: proportions, materials, styling, exterior details, and the little choices that make a space feel expensive.",
        "A one-on-one call could be useful for choosing what to change first, pressure-testing furniture or decor options, or translating saved interior inspiration into a room someone actually lives in.",
      ],
      helpHeading: "Montecito Style can help with",
      helpItems: [
        "Edit a room before buying more pieces.",
        "Choose finishes, colors, lighting, or styling details.",
        "Make a rental or starter home feel more elevated.",
        "Talk through saved inspiration and narrow the direction.",
        "Style shelves, corners, entries, patios, or listing photos.",
        "Decide what is worth spending on and what is not.",
      ],
      whyTitle: "Why a 1:1 call?",
      whyBody:
        "Interior taste is contextual. A quick private call lets someone show the actual room, budget, and constraints, then leave with a smaller and sharper set of decisions.",
      waitlistSubject: "Invite Montecito Style to Take a Seat",
    },
    seats: [],
  },
  {
    id: "chlos-in-a-closet",
    slug: "chlos-in-a-closet",
    name: "Chlo's in a Closet",
    tiktokHandle: "@chlosinacloset",
    title: "Fashion, beauty, and playful closet advice",
    category: "Style & Beauty",
    status: "soon",
    offer: "Closet Confidence",
    price: "Soon",
    length: "15 minutes",
    note: "A fun fashion seat for outfits, shopping links, beauty details, and getting ready energy.",
    image: "/chlos-in-a-closet-profile.jpg",
    objectPosition: "50% 38%",
    accent: "beauty",
    tiktokUrl: "https://www.tiktok.com/@chlosinacloset",
    profile: {
      announcement: "Creator concept profile for Chlo's in a Closet",
      intro:
        "Chlo's in a Closet feels like a high-energy best friend for fashion, beauty, and quick outfit decisions. This seat would make that casual closet help private and specific.",
      about: [
        "Her account reads as personal, playful, and shopping-aware, which is exactly the kind of creator taste people already ask for in comments and DMs.",
        "A one-on-one call could help someone choose what to wear, fix a cart before checkout, or make the final outfit details feel more confident.",
      ],
      helpHeading: "Chlo can help with",
      helpItems: [
        "Choose an outfit for a trip, dinner, party, or event.",
        "Make a shopping cart less chaotic.",
        "Pick accessories, shoes, hair, or makeup direction.",
        "Find a few stronger ways to wear what is already in the closet.",
        "Decide what to return, keep, or buy.",
        "Build a mood for a weekend or night out.",
      ],
      whyTitle: "Why a 1:1 call?",
      whyBody:
        "Sometimes the useful advice is not a huge styling session. It is ten honest minutes with someone who can look at the pieces and say what works.",
      waitlistSubject: "Invite Chlo's in a Closet to Take a Seat",
    },
    seats: [],
  },
  {
    id: "maria-baldini",
    slug: "maria-baldini",
    name: "Maria Baldini",
    instagramHandle: "@maria_baldini",
    tiktokHandle: "@mariabaldini3",
    title: "Classic fashion and old-money outfit polish",
    category: "Style & Beauty",
    status: "soon",
    offer: "Old Money Outfit Edit",
    price: "Soon",
    length: "15 minutes",
    note: "A polished fashion seat for timeless outfits, elevated basics, and event-ready details.",
    image: "/maria-baldini-profile.jpg",
    objectPosition: "50% 50%",
    accent: "style",
    instagramUrl: "https://www.instagram.com/maria_baldini/",
    tiktokUrl: "https://www.tiktok.com/@mariabaldini3",
    location: "Boston",
    profile: {
      announcement: "Creator concept profile for Maria Baldini",
      intro:
        "Maria Baldini brings the classic, put-together fashion lane that makes simple outfits feel more expensive. This seat would be for old-money polish without looking overdone.",
      about: [
        "The fit for Take a Seat is the practical version of aspirational style: choosing the cleaner silhouette, the better neutral, or the one accessory that makes everything look intentional.",
        "A private call could help someone dress for events, refine a capsule, shop more selectively, or make everyday outfits feel a little more elevated.",
      ],
      helpHeading: "Maria can help with",
      helpItems: [
        "Build a classic outfit around pieces you already own.",
        "Choose event looks with polished details.",
        "Find elevated basics that do not feel boring.",
        "Make a capsule wardrobe feel less generic.",
        "Edit a shopping cart toward timeless pieces.",
        "Style neutrals, knits, coats, denim, and accessories.",
      ],
      whyTitle: "Why a 1:1 call?",
      whyBody:
        "Old-money style is all in restraint and proportion. A private call makes it easier to see what should stay simple, what needs tailoring, and what detail finishes the look.",
      waitlistSubject: "Invite Maria Baldini to Take a Seat",
    },
    seats: [],
  },
  {
    id: "rented-flat",
    slug: "rented-flat",
    name: "Rented Flat Edit",
    title: "Warm minimal home advice",
    category: "Home Interiors",
    status: "soon",
    offer: "Rented, Not Ruined",
    price: "Soon",
    length: "20 min",
    note: "What to change, what to leave, and what you will actually get your deposit back on.",
    image: null,
    objectPosition: "50% 50%",
    accent: "home",
    seats: [],
  },
  {
    id: "sarah-elizabeth",
    slug: "sarah-elizabeth",
    name: "Sarah Elizabeth",
    tiktokHandle: "@seisthename",
    title: "Fitness creator prospect",
    category: "Fitness & Wellness",
    status: "soon",
    offer: "Routine Reset",
    price: "Soon",
    length: "15 minutes",
    note: "A fitness seat for realistic training routines, consistency, and getting unstuck.",
    image: null,
    objectPosition: "50% 50%",
    accent: "wellness",
    tiktokUrl: "https://www.tiktok.com/@seisthename",
    profile: {
      announcement: "Creator concept profile for Sarah Elizabeth",
      intro:
        "Sarah Elizabeth is a fitness creator prospect for Take a Seat. This profile is framed around practical routine help until her exact offer is confirmed.",
      about: [
        "The strongest version of this seat is simple: help someone understand what to do this week, what to stop overcomplicating, and how to make a fitness routine feel possible.",
        "A one-on-one call could work well for beginners, people restarting after a break, or anyone who wants a realistic plan before they lose momentum.",
      ],
      helpHeading: "Sarah can help with",
      helpItems: [
        "Plan a realistic week of workouts.",
        "Choose gym or at-home movements that match your level.",
        "Simplify a routine that has too many moving parts.",
        "Build consistency after a break.",
        "Set a beginner-friendly goal for the next month.",
        "Talk through what is actually stopping the habit.",
      ],
      whyTitle: "Why a 1:1 call?",
      whyBody:
        "Fitness advice works better when it fits the person's real schedule, confidence, equipment, and starting point. A private call can turn general motivation into a specific next week.",
      waitlistSubject: "Invite Sarah Elizabeth to Take a Seat",
    },
    seats: [],
  },
  {
    id: "wellness-preview",
    slug: "wellness-preview",
    name: "Wellness Edit",
    title: "Founding creator preview",
    category: "Fitness & Wellness",
    status: "soon",
    offer: "Routine Reset",
    price: "Soon",
    length: "15 minutes",
    note: "A placeholder profile for wellness creators joining the platform later.",
    image: null,
    objectPosition: "50% 50%",
    accent: "wellness",
    seats: [],
  },
  {
    id: "food-preview",
    slug: "food-preview",
    name: "Food Edit",
    title: "Founding creator preview",
    category: "Food",
    status: "soon",
    offer: "Weeknight Plan",
    price: "Soon",
    length: "15 minutes",
    note: "A placeholder profile for food creators and practical meal planning seats.",
    image: null,
    objectPosition: "50% 50%",
    accent: "food",
    seats: [],
  },
  {
    id: "annabel",
    slug: "annabel",
    name: "Annabel Filippini",
    instagramHandle: "@annabelfilippini",
    title: "Take a Seat founder test profile",
    category: "Style & Beauty",
    status: "booking",
    offer: "Founder Test Seat",
    price: "$15",
    length: "15 minutes",
    note: "A private test seat for checking calendar connection, pricing, and checkout.",
    image: null,
    objectPosition: "50% 18%",
    accent: "home",
    location: "Los Angeles, CA",
    seats: [
      {
        id: "annabel-15",
        name: "15 minutes",
        price: "$15",
        unitAmount: 1500,
        format: "Private video call",
        host: "Annabel Filippini",
        description:
          "A quick test booking to confirm the calendar, checkout, and reminder flow works.",
        stripePriceEnv: "STRIPE_PRICE_ANNABEL_15",
      },
      {
        id: "annabel-30",
        name: "30 minutes",
        price: "$30",
        unitAmount: 3000,
        format: "Private video call",
        host: "Annabel Filippini",
        description:
          "A longer test seat for checking how an extended private call appears and pays out.",
        stripePriceEnv: "STRIPE_PRICE_ANNABEL_30",
      },
    ],
  },
  {
    id: "abby",
    slug: "abby",
    name: "Abby Catlin",
    title: "Founding creator preview",
    category: "Style & Beauty",
    status: "soon",
    offer: "Closet Clarity",
    price: "Soon",
    length: "15 minutes",
    note: "A preview seat for everyday outfits, event looks, and better repeat pieces.",
    image: null,
    objectPosition: "50% 16%",
    accent: "style",
    seats: [],
  },
  {
    id: "alex",
    slug: "alex",
    name: "Alex Earl",
    title: "Founding creator preview",
    category: "Style & Beauty",
    status: "soon",
    offer: "Get Ready Edit",
    price: "Soon",
    length: "15 minutes",
    note: "A sample card showing how another influencer profile will sit next to the first live seats.",
    image: null,
    objectPosition: "50% 50%",
    accent: "beauty",
    seats: [],
  },
];

const PUBLIC_MARKETPLACE_CREATOR_IDS = new Set(["ella"]);

export const publicMarketplaceCreators = creators.filter((creator) =>
  PUBLIC_MARKETPLACE_CREATOR_IDS.has(creator.id),
);

export function getCreatorById(id: string) {
  return creators.find((creator) => creator.id === id);
}

export function getCreatorBySlug(slug: string) {
  return creators.find((creator) => creator.slug === slug);
}

export function getSeatById(creator: Creator, seatId: string) {
  return creator.seats.find((seat) => seat.id === seatId);
}
