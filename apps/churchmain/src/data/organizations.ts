export type OrganizationKind = "ministry" | "department";

export type OrganizationIcon =
  | "men"
  | "women"
  | "children"
  | "youth"
  | "music"
  | "prayer"
  | "bible"
  | "evangelism"
  | "welfare"
  | "multimedia"
  | "sanctuary";

export interface OrganizationPicture {
  src: string;
  alt: string;
  caption?: string;
}

export interface Organization {
  slug: string;
  name: string;
  kind: OrganizationKind;
  icon: OrganizationIcon;
  summary: string;
  description: string[];
  email: string;
  meeting: string;
  location: string;
  pictures: OrganizationPicture[];
  websiteUrl?: string;
  websiteLabel?: string;
}

const sharedDescription = [
  "There’s a place for you in the life of Cornerstone. Whether you’re new to our community or looking for your next step, we’d love to help you get connected.",
  "Reach out to find out more about this group, meeting times, and how to get involved.",
];
const sharedDetails = {
  summary: "Find your place in the life of our church.",
  description: sharedDescription,
  email: "connect@rccgcornerstoneassembly.com",
  meeting: "Schedule to be confirmed",
  location: "70-3904 Millar Avenue, Saskatoon",
};

export const ministries: Organization[] = [
  {
    ...sharedDetails,
    slug: "men",
    summary: "A place for men to connect, encourage one another, and grow in faith.",
    name: "Men's Ministry",
    kind: "ministry",
    icon: "men",
    pictures: [],
  },
  {
    ...sharedDetails,
    slug: "women",
    summary: "Cornerstone Excellent Women. Growing in faith, purpose, and sisterhood.",
    name: "Women's Ministry",
    kind: "ministry",
    icon: "women",
    pictures: [],
    websiteUrl: "https://www.womanexcel.com/",
    websiteLabel: "Visit ministry website",
  },
  {
    ...sharedDetails,
    slug: "children",
    summary: "A place for our youngest generation in the life of the church.",
    name: "Children's Ministry",
    kind: "ministry",
    icon: "children",
    pictures: [],
  },
  {
    ...sharedDetails,
    slug: "youths-teenagers",
    summary: "Faith, friendship, and a place for the next generation to belong.",
    name: "Youths & Teenagers",
    kind: "ministry",
    icon: "youth",
    pictures: [],
  },
];

export const departments: Organization[] = [
  {
    ...sharedDetails,
    slug: "music",
    summary: "Bring your love of music to the worship life of our church.",
    name: "Music Department",
    kind: "department",
    icon: "music",
    pictures: [],
  },
  {
    ...sharedDetails,
    slug: "prayer",
    summary: "Share in a life of prayer for our church and community.",
    name: "Prayer Department",
    kind: "department",
    icon: "prayer",
    pictures: [],
  },
  {
    ...sharedDetails,
    slug: "bible-study",
    summary: "Explore the Word and grow in your understanding of scripture.",
    name: "Bible Study Department",
    kind: "department",
    icon: "bible",
    pictures: [],
  },
  {
    ...sharedDetails,
    slug: "evangelism",
    summary: "Share the hope of Jesus with the world around us.",
    name: "Evangelism Department",
    kind: "department",
    icon: "evangelism",
    pictures: [],
  },
  {
    ...sharedDetails,
    slug: "welfare",
    summary: "Find out how to be part of caring for our church family.",
    name: "Welfare Department",
    kind: "department",
    icon: "welfare",
    pictures: [],
  },
  {
    ...sharedDetails,
    slug: "multimedia",
    summary: "Explore ways to bring your creative and technical gifts to church life.",
    name: "Multimedia Department",
    kind: "department",
    icon: "multimedia",
    pictures: [],
  },
  {
    ...sharedDetails,
    slug: "sanctuary-helpers",
    summary: "Help make our shared place of worship a welcoming home.",
    name: "Sanctuary Helpers",
    kind: "department",
    icon: "sanctuary",
    pictures: [],
  },
];
