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

const placeholderSummary =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean imperdiet etiam ultricies nisi vel augue.";

const placeholderDescription = [
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
];
const sharedDetails = {
    summary: placeholderSummary,
    description: placeholderDescription,
    email: "connect@rccgcornerstoneassembly.com",
    meeting: "Schedule to be confirmed",
    location: "70-3904 Millar Avenue, Saskatoon",
};

const womenWebsite =
    import.meta.env.PUBLIC_WOMEN_MINISTRY_URL ??
    "https://www.rccgcornerstonesk.ca/ministries";

export const ministries: Organization[] = [
    {
        ...sharedDetails,
        slug: "men",
        name: "Men's Ministry",
        kind: "ministry",
        icon: "men",
        pictures: [],
    },
    {
        ...sharedDetails,
        slug: "women",
        name: "Women's Ministry",
        kind: "ministry",
        icon: "women",
        pictures: [],
        websiteUrl: womenWebsite,
        websiteLabel: "Visit ministry website",
    },
    {
        ...sharedDetails,
        slug: "children",
        name: "Children's Ministry",
        kind: "ministry",
        icon: "children",
        pictures: [],
    },
    {
        ...sharedDetails,
        slug: "youths-teenagers",
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
        name: "Music Department",
        kind: "department",
        icon: "music",
        pictures: [],
    },
    {
        ...sharedDetails,
        slug: "prayer",
        name: "Prayer Department",
        kind: "department",
        icon: "prayer",
        pictures: [],
    },
    {
        ...sharedDetails,
        slug: "bible-study",
        name: "Bible Study Department",
        kind: "department",
        icon: "bible",
        pictures: [],
    },
    {
        ...sharedDetails,
        slug: "evangelism",
        name: "Evangelism Department",
        kind: "department",
        icon: "evangelism",
        pictures: [],
    },
    {
        ...sharedDetails,
        slug: "welfare",
        name: "Welfare Department",
        kind: "department",
        icon: "welfare",
        pictures: [],
    },
    {
        ...sharedDetails,
        slug: "multimedia",
        name: "Multimedia Department",
        kind: "department",
        icon: "multimedia",
        pictures: [],
    },
    {
        ...sharedDetails,
        slug: "sanctuary-helpers",
        name: "Sanctuary Helpers",
        kind: "department",
        icon: "sanctuary",
        pictures: [],
    },
];
