import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

type ShowSettings = {
  showName: string;
  hostName: string;
  stationName: string;
  market: string;
  showStart: string;
  showEnd: string;
  textLine: string;
  phoneLine: string;
};

type PrepItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  url?: string;
};

type BreakBlock = {
  id: string;
  time: string;
  title: string;
  items: PrepItem[];
};

type Feed = {
  id: string;
  name: string;
  url: string;
  category: string;
  active: boolean;
  storyLimit: number;
};

type FeedDraft = {
  name: string;
  url: string;
  category: string;
  storyLimit: string;
};

type TrafficArea = {
  id: string;
  label: string;
  latitude: string;
  longitude: string;
  description: string;
  active: boolean;
  lastRead?: string;
  lastUpdated?: string;
};

type WeatherLocation = {
  id: string;
  label: string;
  location: string;
  active: boolean;
  lastRead?: string;
  lastUpdated?: string;
};

type CommunityCalendarItem = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  category: string;
  details: string;
  url: string;
  active: boolean;
  source: "manual" | "ics";
  importedFrom?: string;
};

type HeaderBlockKind =
  | "none"
  | "date"
  | "weather"
  | "traffic"
  | "funDays"
  | "birthdays";

type TemplateHeaderDetails = {
  title: string;
  subtitle: string;
  details: string;
  blocks?: HeaderBlockKind[];
};

type RssStory = {
  id: string;
  title: string;
  summary: string;
  category: string;
  link: string;
  feedId?: string;
  feedName?: string;
  source?: string;
  published?: string;
  publishedAt?: string;
};

type ShowTemplate = {
  id: string;
  name: string;
  headerDetails?: TemplateHeaderDetails;
  breaks: BreakBlock[];
  createdAt: string;
  updatedAt: string;
};

type ShowProfile = {
  id: string;
  name: string;
  settings: ShowSettings;
  templates: ShowTemplate[];
  feeds?: Feed[];
  trafficAreas?: TrafficArea[];
  weatherLocations?: WeatherLocation[];
  communityCalendar?: CommunityCalendarItem[];
  createdAt: string;
  updatedAt: string;
};

type Screen = "dashboard" | "workspace" | "daily";

const SHOWS_STORAGE_KEY = "prepdeck.shows.v2";
const TOMTOM_API_KEY_STORAGE_KEY = "prepdeck.tomtomApiKey.v1";

const blankSettings: ShowSettings = {
  showName: "",
  hostName: "",
  stationName: "",
  market: "",
  showStart: "6:00 AM",
  showEnd: "9:00 AM",
  textLine: "",
  phoneLine: "",
};

const DEFAULT_HEADER_BLOCKS: HeaderBlockKind[] = ["date", "weather", "traffic"];

const HEADER_BLOCK_OPTIONS: { value: HeaderBlockKind; label: string }[] = [
  { value: "none", label: "None" },
  { value: "date", label: "Today Info" },
  { value: "weather", label: "Weather" },
  { value: "traffic", label: "Traffic" },
];

const FUN_DAY_LOOKUP: Record<string, string[]> = {
  "01-01": ["New Year’s Day"],
  "01-28": ["National Blueberry Pancake Day"],
  "02-14": ["Valentine’s Day"],
  "03-17": ["St. Patrick’s Day"],
  "04-22": ["Earth Day"],
  "06-30": ["Social Media Day", "Meteor Watch Day"],
  "07-04": ["Independence Day"],
  "10-31": ["Halloween"],
  "11-11": ["Veterans Day"],
  "12-25": ["Christmas Day"],
};

const BIRTHDAY_LOOKUP: Record<string, string[]> = {
  "01-08": ["Elvis Presley"],
  "01-17": ["Betty White"],
  "02-12": ["Abraham Lincoln"],
  "03-14": ["Billy Crystal"],
  "04-15": ["Emma Watson"],
  "06-30": ["Michael Phelps", "Mike Tyson", "Fantasia Barrino"],
  "07-04": ["Post Malone"],
  "08-16": ["Steve Carell"],
  "09-09": ["Adam Sandler"],
  "10-28": ["Julia Roberts"],
  "12-13": ["Taylor Swift"],
  "12-25": ["Jimmy Buffett"],
};

const DEFAULT_FEEDS: Feed[] = [
  {
    id: "sample-bbc",
    name: "BBC News Sample",
    url: "https://feeds.bbci.co.uk/news/rss.xml",
    category: "News",
    active: true,
    storyLimit: 8,
  },
  {
    id: "sample-npr",
    name: "NPR News Sample",
    url: "https://feeds.npr.org/1001/rss.xml",
    category: "News",
    active: true,
    storyLimit: 8,
  },
  {
    id: "sample-country",
    name: "Taste of Country Sample",
    url: "https://tasteofcountry.com/feed/",
    category: "Country Music",
    active: true,
    storyLimit: 8,
  },
];

const emptyFeedDraft: FeedDraft = {
  name: "",
  url: "",
  category: "",
  storyLimit: "8",
};

function formatCurrentShowDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function cleanHeaderBlocks(blocks: HeaderBlockKind[] = []) {
  return blocks.filter((block) =>
    ["date", "weather", "traffic"].includes(block)
  );
}


function createStarterFeeds(): Feed[] {
  return [
    {
      id: makeId(),
      name: "Taste of Country",
      url: "https://tasteofcountry.com/feed/",
      category: "Country",
      storyLimit: 8,
      active: true,
    },
    {
      id: makeId(),
      name: "CBS Sports",
      url: "https://www.cbssports.com/rss/headlines/",
      category: "Sports",
      storyLimit: 8,
      active: true,
    },
    {
      id: makeId(),
      name: "Bozo Criminal of the Day",
      url: "https://www.bozocriminal.com/rss",
      category: "Odd",
      storyLimit: 6,
      active: true,
    },
    {
      id: makeId(),
      name: "Odd Headlines",
      url: "https://www.upi.com/Odd_News/rss/",
      category: "Odd",
      storyLimit: 8,
      active: true,
    },
    {
      id: makeId(),
      name: "Hollywood",
      url: "https://www.hollywoodreporter.com/feed/",
      category: "Entertainment",
      storyLimit: 8,
      active: true,
    },
    {
      id: makeId(),
      name: "Celebrity News",
      url: "https://people.com/feed/",
      category: "Entertainment",
      storyLimit: 8,
      active: true,
    },
    {
      id: makeId(),
      name: "Celebrity Birthdays",
      url: "https://www.onthisday.com/rss/birthdays.php",
      category: "Entertainment",
      storyLimit: 8,
      active: true,
    },
  ];
}

function createStarterTemplate(): ShowTemplate {
  const nowIso = new Date().toISOString();

  return {
    id: makeId(),
    name: "Morning Show Template",
    headerDetails: {
      title: "",
      subtitle: "",
      details: "",
      blocks: ["date", "weather", "traffic"],
    },
    breaks: [
      {
        id: makeId(),
        time: "6:05",
        title: "6:05 Break",
        items: [],
      },
      {
        id: makeId(),
        time: "6:20",
        title: "6:20 Break",
        items: [],
      },
      {
        id: makeId(),
        time: "6:35",
        title: "6:35 Break",
        items: [],
      },
      {
        id: makeId(),
        time: "6:50",
        title: "6:50 Break",
        items: [],
      },
    ],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function stripDailyItems(breaks: BreakBlock[]) {
  return breaks.map((block) => ({
    ...block,
    items: [],
  }));
}

function getDayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff =
    date.getTime() -
    start.getTime() +
    (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000;

  return Math.floor(diff / 86400000);
}

function getChristmasLine(date: Date) {
  const year = date.getFullYear();
  let christmas = new Date(year, 11, 25);

  if (date > christmas) {
    christmas = new Date(year + 1, 11, 25);
  }

  const todayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const christmasStart = new Date(
    christmas.getFullYear(),
    christmas.getMonth(),
    christmas.getDate()
  );

  const days = Math.ceil(
    (christmasStart.getTime() - todayStart.getTime()) / 86400000
  );

  if (days === 0) return "Christmas is today.";
  if (days === 1) return "There is 1 day until Christmas.";

  return `There are ${days} days until Christmas.`;
}

function cleanText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getText(node: Element, names: string[]) {
  for (const name of names) {
    const found = node.getElementsByTagName(name)[0];

    if (found?.textContent) {
      return cleanText(found.textContent);
    }
  }

  return "";
}

function getStoryLink(node: Element) {
  const rssLink = getText(node, ["link"]);

  if (rssLink) {
    return rssLink;
  }

  const atomLinks = Array.from(node.getElementsByTagName("link"));
  const alternate =
    atomLinks.find((item) => item.getAttribute("rel") === "alternate") ??
    atomLinks[0];

  return alternate?.getAttribute("href") ?? "";
}

function parseRssStories(xml: string, feed: Feed): RssStory[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");

  if (doc.querySelector("parsererror")) {
    throw new Error(`Could not read ${feed.name}`);
  }

  const rssItems = Array.from(doc.getElementsByTagName("item"));
  const atomItems = Array.from(doc.getElementsByTagName("entry"));
  const items = rssItems.length ? rssItems : atomItems;

  return items.slice(0, feed.storyLimit || 8).map((item, index) => {
    const title = getText(item, ["title"]) || "Untitled Story";
    const summary =
      getText(item, ["description", "summary", "content", "content:encoded"]) ||
      "No summary available.";
    const link = getStoryLink(item);
    const publishedAt = getText(item, ["pubDate", "published", "updated"]);

    return {
      id: `${feed.id}-${index}-${title}`,
      title,
      summary,
      source: feed.name,
      category: feed.category || "General",
      link,
      publishedAt,
    };
  });
}

function getFeedsForShow(show?: ShowProfile) {
  if (!show) return DEFAULT_FEEDS;
  return show.feeds && show.feeds.length ? show.feeds : DEFAULT_FEEDS;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [shows, setShows] = useState<ShowProfile[]>(() => {
    try {
      const saved = localStorage.getItem(SHOWS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeShowId, setActiveShowId] = useState("");
  const [activeTemplateId, setActiveTemplateId] = useState("");
  const [settings, setSettings] = useState<ShowSettings>(blankSettings);
  const [breaks, setBreaks] = useState<BreakBlock[]>([]);
  const [now, setNow] = useState(new Date());

  const [feedManagerOpen, setFeedManagerOpen] = useState(false);
  const [feedDraft, setFeedDraft] = useState<FeedDraft>(emptyFeedDraft);
  const [storyBank, setStoryBank] = useState<RssStory[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedStatus, setFeedStatus] = useState("");
  const [selectedBreakForStories, setSelectedBreakForStories] = useState("");
  const [activeSourceTab, setActiveSourceTab] = useState<"rss" | "traffic" | "weather" | "community" | "header">("rss");

  const [tomTomApiKey, setTomTomApiKey] = useState(() => {
    try {
      return localStorage.getItem(TOMTOM_API_KEY_STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [trafficDraft, setTrafficDraft] = useState({
    label: "",
    latitude: "",
    longitude: "",
    description: "",
  });
  const [trafficStatus, setTrafficStatus] = useState("");
  const [isTrafficRefreshing, setIsTrafficRefreshing] = useState(false);
  const [weatherDraft, setWeatherDraft] = useState({
    label: "",
    location: "",
  });
  const [weatherStatus, setWeatherStatus] = useState("");
  const [isWeatherRefreshing, setIsWeatherRefreshing] = useState(false);
  const [communityDraft, setCommunityDraft] = useState({
    title: "",
    date: "",
    time: "",
    location: "",
    category: "Community",
    details: "",
    url: "",
  });
  const [communityStatus, setCommunityStatus] = useState("");
  const [showCreatorOpen, setShowCreatorOpen] = useState(false);
  const [showDraft, setShowDraft] = useState<ShowSettings>({
    ...blankSettings,
    showName: "",
    hostName: "",
    stationName: "",
    market: "",
    showStart: "6:00 AM",
    showEnd: "9:00 AM",
  });
  const [initialTemplateNameDraft, setInitialTemplateNameDraft] =
    useState("Standard Template");
  const [editingShowId, setEditingShowId] = useState("");
  const [editShowDraft, setEditShowDraft] = useState<ShowSettings>(blankSettings);
  const [templateCreatorShowId, setTemplateCreatorShowId] = useState("");
  const [templateNameDraft, setTemplateNameDraft] = useState("");
  const [pendingDeleteShowId, setPendingDeleteShowId] = useState("");
  const [pendingDeleteTemplateId, setPendingDeleteTemplateId] = useState("");
  const [templateHeader, setTemplateHeader] = useState<TemplateHeaderDetails>({
    title: "",
    subtitle: "",
    details: "",
    blocks: DEFAULT_HEADER_BLOCKS,
  });
  const [breakCreatorOpen, setBreakCreatorOpen] = useState(false);
  const [breakDraft, setBreakDraft] = useState({
    time: "",
    title: "",
  });
  const [noteCreatorBreakId, setNoteCreatorBreakId] = useState("");
  const [noteDraft, setNoteDraft] = useState({
    title: "Host Note",
    body: "",
  });
  const [dailyBreaks, setDailyBreaks] = useState<BreakBlock[]>([]);
  const [dailySelectedBreakId, setDailySelectedBreakId] = useState("");
  const [dailyNoteCreatorBreakId, setDailyNoteCreatorBreakId] = useState("");
  const [dailyNoteDraft, setDailyNoteDraft] = useState({
    title: "Host Note",
    body: "",
  });
  const [dailyBreakOptionDraft, setDailyBreakOptionDraft] = useState({
    blockId: "",
    type: "",
    title: "",
    body: "",
  });
  const [activeDailyContentTab, setActiveDailyContentTab] =
    useState<"rss" | "traffic" | "weather" | "community" | "header">("rss");
  const [activeRssFeedId, setActiveRssFeedId] = useState("all");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [liveNationalDays, setLiveNationalDays] = useState<string[]>([]);
  const [liveBirthdays, setLiveBirthdays] = useState<string[]>([]);
  const [liveHeaderDateKey, setLiveHeaderDateKey] = useState("");
  const [dailyStationPriority, setDailyStationPriority] = useState("");
  const [dailyContestReminder, setDailyContestReminder] = useState("");
  const [dailyShowFocus, setDailyShowFocus] = useState("");
  const [dailyTeaseLine, setDailyTeaseLine] = useState("");

  useEffect(() => {
    localStorage.setItem(SHOWS_STORAGE_KEY, JSON.stringify(shows));
  }, [shows]);

  useEffect(() => {
    try {
      localStorage.setItem(TOMTOM_API_KEY_STORAGE_KEY, tomTomApiKey);
    } catch {
      // Ignore local save failures.
    }
  }, [tomTomApiKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (breaks.length === 0) {
      setSelectedBreakForStories("");
      return;
    }

    const stillExists = breaks.some((block) => block.id === selectedBreakForStories);

    if (!stillExists) {
      setSelectedBreakForStories(breaks[0].id);
    }
  }, [breaks, selectedBreakForStories]);

  const activeShow = shows.find((show) => show.id === activeShowId);
  const activeTemplate = activeShow?.templates.find(
    (template) => template.id === activeTemplateId
  );
  const activeFeeds = getFeedsForShow(activeShow);
  const activeFeedCount = activeFeeds.filter((feed) => feed.active).length;
  const activeTrafficAreas = activeShow?.trafficAreas ?? [];
  const activeTrafficCount = activeTrafficAreas.filter((area) => area.active).length;
  const activeWeatherLocations = activeShow?.weatherLocations ?? [];
  const activeWeatherCount = activeWeatherLocations.filter((location) => location.active).length;
  const activeCommunityItems = activeShow?.communityCalendar ?? [];
  const activeCommunityCount = activeCommunityItems.filter((item) => item.active).length;

  const dateLine = useMemo(
    () =>
      now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    [now]
  );

  const timeLine = useMemo(
    () =>
      now.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
    [now]
  );

  const todayLine = `Today is the ${getDayOfYear(
    now
  )} day of ${now.getFullYear()}.`;

  const christmasLine = getChristmasLine(now);

  function setFeedsForActiveShow(updater: (feeds: Feed[]) => Feed[]) {
    if (!activeShow) return;

    setShows((current) =>
      current.map((show) =>
        show.id === activeShow.id
          ? {
              ...show,
              feeds: updater(getFeedsForShow(show)),
              updatedAt: new Date().toISOString(),
            }
          : show
      )
    );
  }

  function updateTemplateHeader(
    key: "title" | "subtitle" | "details",
    value: string
  ) {
    setTemplateHeader((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateHeaderBlock(index: number, value: HeaderBlockKind) {
    setTemplateHeader((current) => {
      const blocks = [...(current.blocks ?? DEFAULT_HEADER_BLOCKS)];

      while (blocks.length < 3) {
        blocks.push("none");
      }

      blocks[index] = value;

      return {
        ...current,
        blocks: blocks.slice(0, 3),
      };
    });
  }


  function getHeaderOptionDescription(block: HeaderBlockKind) {
    if (block === "date") {
      return "Date, time, day of year, and days until Christmas.";
    }

    if (block === "weather") {
      return "Shows the current generated weather read.";
    }

    if (block === "traffic") {
      return "Shows the current generated traffic read.";
    }

    if (block === "funDays") {
      return "Shows national days and today-style observances.";
    }

    if (block === "birthdays") {
      return "Shows celebrity birthdays for the day.";
    }

    return "";
  }

  function addHeaderBlockToTemplate(block: HeaderBlockKind) {
    if (!["date", "weather", "traffic"].includes(block)) return;
    if (block === "none") return;

    setTemplateHeader((current) => {
      const currentBlocks = (current.blocks ?? DEFAULT_HEADER_BLOCKS)
        .filter((item) => item !== "none")
        .slice(0, 3);

      if (currentBlocks.includes(block)) {
        return current;
      }

      if (currentBlocks.length >= 3) {
        window.alert("You can add up to three header blocks.");
        return current;
      }

      return {
        ...current,
        blocks: [...currentBlocks, block],
      };
    });
  }

  function removeHeaderBlockFromTemplate(index: number) {
    setTemplateHeader((current) => {
      const currentBlocks = (current.blocks ?? DEFAULT_HEADER_BLOCKS)
        .filter((block) => block !== "none")
        .slice(0, 3);

      return {
        ...current,
        blocks: currentBlocks.filter((_, blockIndex) => blockIndex !== index),
      };
    });
  }

  function createShow() {
    setShowDraft({
      ...blankSettings,
      showName: "",
      hostName: "",
      stationName: "",
      market: "",
      showStart: "6:00 AM",
      showEnd: "9:00 AM",
    });
    setInitialTemplateNameDraft("Standard Template");
    setShowCreatorOpen(true);
  }

  function updateShowDraft(key: keyof ShowSettings, value: string) {
    setShowDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function saveNewShowFromForm() {
    const showName = showDraft.showName.trim();

    if (!showName) {
      window.alert("Show name is required.");
      return;
    }

    const nowIso = new Date().toISOString();
    const initialTemplateName =
      initialTemplateNameDraft.trim() || "Standard Template";

    const newSettings: ShowSettings = {
      ...showDraft,
      showName,
      hostName: showDraft.hostName.trim(),
      stationName: showDraft.stationName.trim(),
      market: showDraft.market.trim(),
      showStart: showDraft.showStart.trim() || "6:00 AM",
      showEnd: showDraft.showEnd.trim() || "9:00 AM",
      textLine: showDraft.textLine.trim(),
      phoneLine: showDraft.phoneLine.trim(),
    };

    const standardTemplate: ShowTemplate = {
      id: makeId(),
      name: initialTemplateName,
      headerDetails: {
        title: initialTemplateName,
        subtitle: "",
        details: "",
        blocks: DEFAULT_HEADER_BLOCKS,
      },
      breaks: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const show: ShowProfile = {
      id: makeId(),
      name: showName,
      settings: newSettings,
      templates: [standardTemplate],
      feeds: DEFAULT_FEEDS,
      trafficAreas: [],
      weatherLocations: [],
      communityCalendar: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setShows((current) =>
      [...current, show].sort((a, b) => a.name.localeCompare(b.name))
    );

    setActiveShowId(show.id);
    setActiveTemplateId(standardTemplate.id);
    setSettings(newSettings);
    setBreaks([]);
    setStoryBank([]);
    setFeedStatus("");
    setShowCreatorOpen(false);
    setScreen("workspace");
  }

  function renameShow(showId: string) {
    const show = shows.find((item) => item.id === showId);
    if (!show) return;

    setEditShowDraft({
      ...blankSettings,
      ...show.settings,
    });
    setEditingShowId(showId);
    setPendingDeleteShowId("");
  }

  function updateEditShowDraft(key: keyof ShowSettings, value: string) {
    setEditShowDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function saveShowEdits(showId: string) {
    const showName = editShowDraft.showName.trim();

    if (!showName) {
      window.alert("Show name is required.");
      return;
    }

    const nextSettings: ShowSettings = {
      ...editShowDraft,
      showName,
      hostName: editShowDraft.hostName.trim(),
      stationName: editShowDraft.stationName.trim(),
      market: editShowDraft.market.trim(),
      showStart: editShowDraft.showStart.trim() || "6:00 AM",
      showEnd: editShowDraft.showEnd.trim() || "9:00 AM",
      textLine: editShowDraft.textLine.trim(),
      phoneLine: editShowDraft.phoneLine.trim(),
    };

    setShows((current) =>
      current.map((item) =>
        item.id === showId
          ? {
              ...item,
              name: showName,
              settings: nextSettings,
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );

    if (activeShowId === showId) {
      setSettings(nextSettings);
    }

    setEditingShowId("");
  }

  function cancelShowEdit() {
    setEditingShowId("");
  }

  function deleteShow(showId: string) {
    if (pendingDeleteShowId !== showId) {
      setPendingDeleteShowId(showId);
      setEditingShowId("");
      return;
    }

    setShows((current) => current.filter((item) => item.id !== showId));

    if (activeShowId === showId) {
      setActiveShowId("");
      setActiveTemplateId("");
      setScreen("dashboard");
    }

    setPendingDeleteShowId("");
  }

  function createTemplate(showId: string) {
    setTemplateCreatorShowId(showId);
    setTemplateNameDraft("");
    setPendingDeleteShowId("");
  }

  function saveNewTemplateFromForm(showId: string) {
    const show = shows.find((item) => item.id === showId);
    if (!show) return;

    const templateName = templateNameDraft.trim();

    if (!templateName) {
      window.alert("Template name is required.");
      return;
    }

    const nowIso = new Date().toISOString();

    const template: ShowTemplate = {
      id: makeId(),
      name: templateName,
      headerDetails: {
        title: templateName,
        subtitle: "",
        details: "",
        blocks: DEFAULT_HEADER_BLOCKS,
      },
      breaks: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setShows((current) =>
      current.map((item) =>
        item.id === showId
          ? {
              ...item,
              templates: [...item.templates, template].sort((a, b) =>
                a.name.localeCompare(b.name)
              ),
              updatedAt: nowIso,
            }
          : item
      )
    );

    setTemplateCreatorShowId("");
    setTemplateNameDraft("");
  }

  function cancelTemplateCreate() {
    setTemplateCreatorShowId("");
    setTemplateNameDraft("");
  }

  function deleteTemplate(showId: string, templateId: string) {
    const pendingId = `${showId}:${templateId}`;

    if (pendingDeleteTemplateId !== pendingId) {
      setPendingDeleteTemplateId(pendingId);
      return;
    }

    setShows((current) =>
      current.map((item) =>
        item.id === showId
          ? {
              ...item,
              templates: item.templates.filter(
                (templateItem) => templateItem.id !== templateId
              ),
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );

    if (activeShowId === showId && activeTemplateId === templateId) {
      setActiveTemplateId("");
      setScreen("dashboard");
    }

    setPendingDeleteTemplateId("");
  }


  function cloneBreaksForDaily(sourceBreaks: BreakBlock[]) {
    return sourceBreaks.map((block) => ({
      ...block,
      id: makeId(),
      items: block.items.map((item) => ({
        ...item,
        id: makeId(),
      })),
    }));
  }

  function startDailyPrepFromShowCard(showId: string, templateId: string) {
    const show = shows.find((item) => item.id === showId);
    const template = show?.templates.find((item) => item.id === templateId);

    if (!show || !template) {
      window.alert("That show or template could not be found.");
      return;
    }

    startDailyPrep(show, template);
  }

  function startDailyPrep(show: ShowProfile, template: ShowTemplate) {
    const headerBlocks = Array.isArray(template.headerDetails?.blocks)
      ? template.headerDetails.blocks.filter(Boolean).slice(0, 3)
      : DEFAULT_HEADER_BLOCKS;

    const sourceBreaks = Array.isArray(template.breaks)
      ? template.breaks
      : [];

    const cleanedBreaks =
      sourceBreaks.length > 0
        ? sourceBreaks.map((block) => ({
            id: block.id || makeId(),
            time: block.time || "",
            title: block.title || "Break",
            items: Array.isArray(block.items)
              ? block.items.map((item) => ({
                  id: item.id || makeId(),
                  type: item.type || "Item",
                  title: item.title || "Untitled",
                  body: item.body || "",
                  url: item.url,
                }))
              : [],
          }))
        : [
            {
              id: makeId(),
              time: show.settings.showStart || "6:00 AM",
              title: "Opening Break",
              items: [],
            },
          ];

    const clonedBreaks = cleanedBreaks.map((block) => ({
      ...block,
      id: makeId(),
      items: block.items.map((item) => ({
        ...item,
        id: makeId(),
      })),
    }));

    setActiveShowId(show.id);
    setActiveTemplateId(template.id);
    setTemplateHeader((current) => ({
      ...current,
      blocks: cleanHeaderBlocks(headerBlocks).length
          ? cleanHeaderBlocks(headerBlocks)
          : DEFAULT_HEADER_BLOCKS,
    }));
    setBreaks(cleanedBreaks);
    setDailyBreaks(clonedBreaks);
    setDailySelectedBreakId(clonedBreaks[0]?.id ?? "");
    setStoryBank([]);
    setFeedStatus("");
    setTrafficStatus("");
    setWeatherStatus("");
    setPreviewOpen(false);
    setScreen("daily");
  }

  function updateDailyNoteDraft(key: "title" | "body", value: string) {
    setDailyNoteDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openDailyNoteForm(blockId: string) {
    setDailyNoteCreatorBreakId(blockId);
    setDailyNoteDraft({
      title: "Host Note",
      body: "",
    });
  }

  function saveDailyNoteToBreak(blockId: string) {
    const title = dailyNoteDraft.title.trim() || "Host Note";
    const body = dailyNoteDraft.body.trim();

    setDailyBreaks((current) =>
      current.map((block) =>
        block.id === blockId
          ? {
              ...block,
              items: [
                ...block.items,
                {
                  id: makeId(),
                  type: "Host Note",
                  title,
                  body,
                },
              ],
            }
          : block
      )
    );

    setDailyNoteCreatorBreakId("");
    setDailyNoteDraft({
      title: "Host Note",
      body: "",
    });
  }

  function cancelDailyNoteCreate() {
    setDailyNoteCreatorBreakId("");
    setDailyNoteDraft({
      title: "Host Note",
      body: "",
    });
  }

  function openDailyBreakOptionForm(blockId: string, type: string) {
    setDailyBreakOptionDraft({
      blockId,
      type,
      title: type,
      body: "",
    });
  }

  function updateDailyBreakOptionDraft(key: "title" | "body", value: string) {
    setDailyBreakOptionDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function saveDailyBreakOptionToBreak() {
    const blockId = dailyBreakOptionDraft.blockId;
    const type = dailyBreakOptionDraft.type || "Break Item";
    const title = dailyBreakOptionDraft.title.trim() || type;
    const body = dailyBreakOptionDraft.body.trim();

    if (!blockId) return;

    setDailyBreaks((current) =>
      current.map((block) =>
        block.id === blockId
          ? {
              ...block,
              items: [
                ...block.items,
                {
                  id: makeId(),
                  type,
                  title,
                  body,
                },
              ],
            }
          : block
      )
    );

    setDailyBreakOptionDraft({
      blockId: "",
      type: "",
      title: "",
      body: "",
    });
  }

  function cancelDailyBreakOptionCreate() {
    setDailyBreakOptionDraft({
      blockId: "",
      type: "",
      title: "",
      body: "",
    });
  }

  function removeDailyItemFromBreak(blockId: string, itemId: string) {
    setDailyBreaks((current) =>
      current.map((block) =>
        block.id === blockId
          ? {
              ...block,
              items: block.items.filter((item) => item.id !== itemId),
            }
          : block
      )
    );
  }

  function addPrepItemToDailyBreak(item: PrepItem) {
    if (!dailySelectedBreakId) {
      window.alert("Choose a break first.");
      return;
    }

    setDailyBreaks((current) =>
      current.map((block) =>
        block.id === dailySelectedBreakId
          ? {
              ...block,
              items: [...block.items, item],
            }
          : block
      )
    );
  }

  function addRssStoryToDailyBreak(story: RssStory) {
    addPrepItemToDailyBreak({
      id: makeId(),
      type: story.category || "RSS",
      title: story.title,
      body: story.summary || story.feedName || "",
      url: story.link,
    });
  }

  function addCommunityItemToDailyBreak(item: CommunityCalendarItem) {
    const when = `${item.date}${item.time ? ` at ${item.time}` : ""}`;
    const where = item.location ? ` Location: ${item.location}.` : "";
    const details = item.details ? ` ${item.details}` : "";

    addPrepItemToDailyBreak({
      id: makeId(),
      type: "Community Calendar",
      title: item.title,
      body: `${when}.${where}${details}`.trim(),
      url: item.url,
    });
  }

  function addTrafficReadToDailyBreak(area: TrafficArea) {
    addPrepItemToDailyBreak({
      id: makeId(),
      type: "Traffic",
      title: area.label,
      body:
        area.lastRead ||
        "Refresh traffic first, then add the generated read to the show.",
    });
  }

  function addWeatherLocationToDailyBreak(location: WeatherLocation) {
    addPrepItemToDailyBreak({
      id: makeId(),
      type: "Weather",
      title: location.label,
      body:
        location.lastRead ||
        `Refresh weather first for ${location.location}, then add the generated read to the show.`,
    });
  }

  async function refreshDailySources() {
    await refreshRssFeeds();
    await refreshAllTrafficAreas();
    await refreshAllWeatherLocations();
  }


  function startDailyPrepFromCurrentTemplate() {
    if (!activeShow || !activeTemplate) {
      window.alert("Open a show template first.");
      return;
    }

    startDailyPrep(activeShow, {
      ...activeTemplate,
      breaks,
      headerDetails: templateHeader,
      updatedAt: new Date().toISOString(),
    });
  }

  function openTemplate(show: ShowProfile, template: ShowTemplate) {
    setActiveShowId(show.id);
    setActiveTemplateId(template.id);
    setSettings(show.settings);
    setTemplateHeader({
      title: template.headerDetails?.title ?? template.name,
      subtitle: template.headerDetails?.subtitle ?? "",
      details: template.headerDetails?.details ?? "",
      blocks: (template.headerDetails?.blocks ?? DEFAULT_HEADER_BLOCKS)
        .filter((block) => block !== "none")
        .slice(0, 3),
    });
    setBreaks(
      template.breaks.map((block) => ({
        ...block,
        items: block.items.map((item) => ({ ...item })),
      }))
    );
    setSelectedBreakForStories(template.breaks[0]?.id ?? "");
    setStoryBank([]);
    setFeedStatus("");
    setTrafficStatus("");
    setWeatherStatus("");
    setScreen("workspace");
  }

  function updateSetting(key: keyof ShowSettings, value: string) {
    setSettings((current) => {
      const nextSettings = {
        ...current,
        [key]: value,
      };

      if (activeShowId) {
        setShows((currentShows) =>
          currentShows.map((show) =>
            show.id === activeShowId
              ? {
                  ...show,
                  name:
                    key === "showName" && value.trim()
                      ? value.trim()
                      : show.name,
                  settings: nextSettings,
                  updatedAt: new Date().toISOString(),
                }
              : show
          )
        );
      }

      return nextSettings;
    });
  }

  function addBreakBlock() {
    setBreakDraft({
      time: settings.showStart || "6:00 AM",
      title: "Break",
    });
    setBreakCreatorOpen(true);
  }

  function updateBreakDraft(key: "time" | "title", value: string) {
    setBreakDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function saveBreakBlockFromForm() {
    const time = breakDraft.time.trim();
    const title = breakDraft.title.trim();

    if (!time) {
      window.alert("Break time is required.");
      return;
    }

    const newBreak: BreakBlock = {
      id: makeId(),
      time,
      title: title || "Break",
      items: [],
    };

    setBreaks((current) => [...current, newBreak]);
    setSelectedBreakForStories((current) => current || newBreak.id);
    setBreakCreatorOpen(false);
    setBreakDraft({
      time: "",
      title: "",
    });
  }

  function cancelBreakCreate() {
    setBreakCreatorOpen(false);
    setBreakDraft({
      time: "",
      title: "",
    });
  }

  function updateBreak(blockId: string, key: "time" | "title", value: string) {
    setBreaks((current) =>
      current.map((block) =>
        block.id === blockId
          ? {
              ...block,
              [key]: value,
            }
          : block
      )
    );
  }

  function deleteBreak(blockId: string) {
    setBreaks((current) => current.filter((block) => block.id !== blockId));
  }

  function addNoteToBreak(blockId: string) {
    setNoteCreatorBreakId(blockId);
    setNoteDraft({
      title: "Host Note",
      body: "",
    });
  }

  function updateNoteDraft(key: "title" | "body", value: string) {
    setNoteDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function saveNoteToBreak(blockId: string) {
    const title = noteDraft.title.trim() || "Host Note";
    const body = noteDraft.body.trim();

    setBreaks((current) =>
      current.map((block) =>
        block.id === blockId
          ? {
              ...block,
              items: [
                ...block.items,
                {
                  id: makeId(),
                  type: "Host Note",
                  title,
                  body,
                },
              ],
            }
          : block
      )
    );

    setNoteCreatorBreakId("");
    setNoteDraft({
      title: "Host Note",
      body: "",
    });
  }

  function cancelNoteCreate() {
    setNoteCreatorBreakId("");
    setNoteDraft({
      title: "Host Note",
      body: "",
    });
  }

  function addStoryToBreak(story: RssStory) {
    if (!selectedBreakForStories) {
      window.alert("Add or choose a break first.");
      return;
    }

    const body = [
      story.summary,
      (story.source || story.feedName) ? `Source: ${story.source || story.feedName}` : "",
      story.link ? `Link: ${story.link}` : "",
    ]
      .filter(Boolean)
      .join("");

    setBreaks((current) =>
      current.map((block) =>
        block.id === selectedBreakForStories
          ? {
              ...block,
              items: [
                ...block.items,
                {
                  id: makeId(),
                  type: "RSS Story",
                  title: story.title,
                  body,
                },
              ],
            }
          : block
      )
    );
  }

  function deleteItem(blockId: string, itemId: string) {
    setBreaks((current) =>
      current.map((block) =>
        block.id === blockId
          ? {
              ...block,
              items: block.items.filter((item) => item.id !== itemId),
            }
          : block
      )
    );
  }

  function saveSetupToTemplate() {
    if (!activeShowId || !activeTemplateId) {
      window.alert("Open a template first.");
      return;
    }

    const nowIso = new Date().toISOString();

    const savedHeader: TemplateHeaderDetails = {
      title: templateHeader.title.trim(),
      subtitle: templateHeader.subtitle.trim(),
      details: templateHeader.details.trim(),
      blocks: getActiveHeaderBlocks(),
    };

    const savedBreaks = breaks.map((block) => ({
      ...block,
      items: block.items.map((item) => ({ ...item })),
    }));

    setTemplateHeader(savedHeader);

    setShows((currentShows) =>
      currentShows.map((show) =>
        show.id === activeShowId
          ? {
              ...show,
              templates: show.templates.map((template) =>
                template.id === activeTemplateId
                  ? {
                      ...template,
                      headerDetails: savedHeader,
                      breaks: savedBreaks,
                      updatedAt: nowIso,
                    }
                  : template
              ),
              updatedAt: nowIso,
            }
          : show
      )
    );
  }

  function startNewBlankDay() {
    const okay = window.confirm(
      "Start a new blank day? This clears today's notes but keeps the saved break structure."
    );

    if (!okay) return;

    setBreaks((current) => stripDailyItems(current));
  }

  function updateFeedDraft(key: keyof FeedDraft, value: string) {
    setFeedDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function addFeed() {
    if (!activeShow) {
      window.alert("Open a show first.");
      return;
    }

    if (!feedDraft.name.trim() || !feedDraft.url.trim()) {
      window.alert("Feed name and feed URL are required.");
      return;
    }

    const nextFeed: Feed = {
      id: makeId(),
      name: feedDraft.name.trim(),
      url: feedDraft.url.trim(),
      category: feedDraft.category.trim() || "General",
      active: true,
      storyLimit: Number(feedDraft.storyLimit) || 8,
    };

    setFeedsForActiveShow((feeds) => [...feeds, nextFeed]);
    setFeedDraft(emptyFeedDraft);
  }

  function toggleFeed(feedId: string) {
    setFeedsForActiveShow((feeds) =>
      feeds.map((feed) =>
        feed.id === feedId
          ? {
              ...feed,
              active: !feed.active,
            }
          : feed
      )
    );
  }

  function deleteFeed(feedId: string) {
    setFeedsForActiveShow((feeds) => feeds.filter((feed) => feed.id !== feedId));
  }

  async function refreshRssFeeds() {
    if (!activeShow) {
      window.alert("Open a show first.");
      return;
    }

    const feedsToRefresh = activeFeeds.filter((feed) => feed.active);

    if (feedsToRefresh.length === 0) {
      setStoryBank([]);
      setFeedStatus("No active RSS feeds for this show.");
      return;
    }

    setIsRefreshing(true);
    setFeedStatus("Refreshing RSS feeds...");

    const stories: RssStory[] = [];
    const failures: string[] = [];

    for (const feed of feedsToRefresh) {
      try {
        const xml = await invoke<string>("fetch_url", { url: feed.url });
        stories.push(...parseRssStories(xml, feed));
      } catch {
        failures.push(feed.name);
      }
    }

    setStoryBank(stories);
    setIsRefreshing(false);

    if (failures.length) {
      setFeedStatus(
        `RSS test found ${stories.length} available stories. Could not refresh: ${failures.join(", ")}.`
      );
    } else {
      setFeedStatus(`RSS test found ${stories.length} available stories.`);
    }
  }


  function setTrafficAreasForActiveShow(
    updater: (trafficAreas: TrafficArea[]) => TrafficArea[]
  ) {
    if (!activeShow) return;

    setShows((current) =>
      current.map((show) =>
        show.id === activeShow.id
          ? {
              ...show,
              trafficAreas: updater(show.trafficAreas ?? []),
              updatedAt: new Date().toISOString(),
            }
          : show
      )
    );
  }

  function updateTrafficDraft(
    key: "label" | "latitude" | "longitude" | "description",
    value: string
  ) {
    setTrafficDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function addTrafficArea() {
    if (!activeShow) {
      window.alert("Open a show first.");
      return;
    }

    const label = trafficDraft.label.trim();
    const latitude = trafficDraft.latitude.trim();
    const longitude = trafficDraft.longitude.trim();

    if (!label || !latitude || !longitude) {
      window.alert("Traffic label, latitude, and longitude are required.");
      return;
    }

    const nextArea: TrafficArea = {
      id: makeId(),
      label,
      latitude,
      longitude,
      description: trafficDraft.description.trim(),
      active: true,
    };

    setTrafficAreasForActiveShow((areas) => [...areas, nextArea]);

    setTrafficDraft({
      label: "",
      latitude: "",
      longitude: "",
      description: "",
    });
  }

  function toggleTrafficArea(areaId: string) {
    setTrafficAreasForActiveShow((areas) =>
      areas.map((area) =>
        area.id === areaId
          ? {
              ...area,
              active: !area.active,
            }
          : area
      )
    );
  }

  function deleteTrafficArea(areaId: string) {
    setTrafficAreasForActiveShow((areas) =>
      areas.filter((area) => area.id !== areaId)
    );
  }

  function buildTrafficRead(area: TrafficArea, data: any) {
    const segment = data?.flowSegmentData ?? data;

    const currentSpeed = Number(segment?.currentSpeed ?? 0);
    const freeFlowSpeed = Number(segment?.freeFlowSpeed ?? 0);
    const currentTravelTime = Number(segment?.currentTravelTime ?? 0);
    const freeFlowTravelTime = Number(segment?.freeFlowTravelTime ?? 0);
    const roadClosure = Boolean(segment?.roadClosure);

    if (roadClosure) {
      return `${area.label}: There appears to be a road closure near this traffic point. Check conditions before sending listeners that way.`;
    }

    if (!currentSpeed || !freeFlowSpeed) {
      return `${area.label}: Traffic data came back, but there was not enough speed information to generate a clean read.`;
    }

    const ratio = currentSpeed / freeFlowSpeed;
    const delaySeconds = Math.max(0, currentTravelTime - freeFlowTravelTime);
    const delayMinutes = Math.round(delaySeconds / 60);

    let condition = "moving normally";

    if (ratio < 0.45) {
      condition = "very heavy";
    } else if (ratio < 0.7) {
      condition = "slower than normal";
    } else if (ratio < 0.9) {
      condition = "a little slow";
    }

    const speedLine = `current speed is about ${Math.round(
      currentSpeed
    )} miles per hour, compared with a normal speed of about ${Math.round(
      freeFlowSpeed
    )}.`;

    const delayLine =
      delayMinutes > 0
        ? `That is adding about ${delayMinutes} minute${
            delayMinutes === 1 ? "" : "s"
          } of delay.`
        : "No major delay is showing right now.";

    return `${area.label}: Traffic is ${condition}. The ${speedLine} ${delayLine}`;
  }

  async function refreshTrafficArea(area: TrafficArea) {
    if (!tomTomApiKey.trim()) {
      throw new Error("TomTom API key is required.");
    }

    const point = `${area.latitude},${area.longitude}`;
    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${encodeURIComponent(
      point
    )}&unit=mph&key=${encodeURIComponent(tomTomApiKey.trim())}`;

    const response = await invoke<string>("fetch_url", { url });
    const data = JSON.parse(response);
    return buildTrafficRead(area, data);
  }

  async function refreshAllTrafficAreas() {
    if (!activeShow) {
      window.alert("Open a show first.");
      return;
    }

    const areas = activeTrafficAreas.filter((area) => area.active);

    if (!tomTomApiKey.trim()) {
      setTrafficStatus("Enter a TomTom API key before refreshing traffic.");
      return;
    }

    if (areas.length === 0) {
      setTrafficStatus("No active traffic areas for this show.");
      return;
    }

    setIsTrafficRefreshing(true);
    setTrafficStatus("Refreshing traffic...");

    const updatedReads: Record<string, string> = {};
    const failures: string[] = [];

    for (const area of areas) {
      try {
        updatedReads[area.id] = await refreshTrafficArea(area);
      } catch {
        failures.push(area.label);
      }
    }

    const nowIso = new Date().toISOString();

    setTrafficAreasForActiveShow((currentAreas) =>
      currentAreas.map((area) =>
        updatedReads[area.id]
          ? {
              ...area,
              lastRead: updatedReads[area.id],
              lastUpdated: nowIso,
            }
          : area
      )
    );

    setIsTrafficRefreshing(false);

    const successCount = Object.keys(updatedReads).length;

    if (failures.length) {
      setTrafficStatus(
        `Updated ${successCount} traffic area${
          successCount === 1 ? "" : "s"
        }. Could not refresh: ${failures.join(", ")}.`
      );
    } else {
      setTrafficStatus(
        `Updated ${successCount} traffic area${
          successCount === 1 ? "" : "s"
        }.`
      );
    }
  }


  function setWeatherLocationsForActiveShow(
    updater: (locations: WeatherLocation[]) => WeatherLocation[]
  ) {
    if (!activeShow) return;

    setShows((current) =>
      current.map((show) =>
        show.id === activeShow.id
          ? {
              ...show,
              weatherLocations: updater(show.weatherLocations ?? []),
              updatedAt: new Date().toISOString(),
            }
          : show
      )
    );
  }

  function updateWeatherDraft(key: "label" | "location", value: string) {
    setWeatherDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function addWeatherLocation() {
    if (!activeShow) return;

    const label = weatherDraft.label.trim();
    const location = weatherDraft.location.trim();

    if (!label || !location) {
      window.alert("Weather label and location are required.");
      return;
    }

    setWeatherLocationsForActiveShow((locations) => [
      ...locations,
      {
        id: makeId(),
        label,
        location,
        active: true,
      },
    ]);

    setWeatherDraft({
      label: "",
      location: "",
    });
  }

  function toggleWeatherLocation(locationId: string) {
    setWeatherLocationsForActiveShow((locations) =>
      locations.map((location) =>
        location.id === locationId
          ? { ...location, active: !location.active }
          : location
      )
    );
  }

  function deleteWeatherLocation(locationId: string) {
    setWeatherLocationsForActiveShow((locations) =>
      locations.filter((location) => location.id !== locationId)
    );
  }


  function setCommunityCalendarForActiveShow(
    updater: (items: CommunityCalendarItem[]) => CommunityCalendarItem[]
  ) {
    if (!activeShow) return;

    setShows((current) =>
      current.map((show) =>
        show.id === activeShow.id
          ? {
              ...show,
              communityCalendar: updater(show.communityCalendar ?? []),
              updatedAt: new Date().toISOString(),
            }
          : show
      )
    );
  }

  function updateCommunityDraft(
    key:
      | "title"
      | "date"
      | "time"
      | "location"
      | "category"
      | "details"
      | "url",
    value: string
  ) {
    setCommunityDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function addCommunityItem() {
    if (!activeShow) return;

    const title = communityDraft.title.trim();
    const date = communityDraft.date.trim();

    if (!title || !date) {
      window.alert("Community item title and date are required.");
      return;
    }

    const newItem: CommunityCalendarItem = {
      id: makeId(),
      title,
      date,
      time: communityDraft.time.trim(),
      location: communityDraft.location.trim(),
      category: communityDraft.category.trim() || "Community",
      details: communityDraft.details.trim(),
      url: communityDraft.url.trim(),
      active: true,
      source: "manual",
    };

    setCommunityCalendarForActiveShow((items) =>
      [...items, newItem].sort((a, b) =>
        `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
      )
    );

    setCommunityDraft({
      title: "",
      date: "",
      time: "",
      location: "",
      category: "Community",
      details: "",
      url: "",
    });
    setCommunityStatus("Community item added.");
  }

  function toggleCommunityItem(itemId: string) {
    setCommunityCalendarForActiveShow((items) =>
      items.map((item) =>
        item.id === itemId ? { ...item, active: !item.active } : item
      )
    );
  }

  function deleteCommunityItem(itemId: string) {
    setCommunityCalendarForActiveShow((items) =>
      items.filter((item) => item.id !== itemId)
    );
  }

  function cleanIcsValue(value: string) {
    return value
      .replace(/\\n/g, " ")
      .replace(/\\,/g, ",")
      .replace(/\\;/g, ";")
      .replace(/\\\\/g, "\\")
      .trim();
  }

  function formatIcsDateTime(value: string) {
    const clean = value.trim();

    if (!clean) {
      return { date: "", time: "" };
    }

    const datePart = clean.slice(0, 8);

    if (!/^\d{8}$/.test(datePart)) {
      return { date: "", time: "" };
    }

    const date = `${datePart.slice(0, 4)}-${datePart.slice(
      4,
      6
    )}-${datePart.slice(6, 8)}`;

    if (!clean.includes("T")) {
      return { date, time: "" };
    }

    const hour = Number(clean.slice(9, 11));
    const minute = clean.slice(11, 13) || "00";

    if (Number.isNaN(hour)) {
      return { date, time: "" };
    }

    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return {
      date,
      time: `${displayHour}:${minute} ${suffix}`,
    };
  }

  function parseIcsEvents(icsText: string, filename: string) {
    const unfoldedLines: string[] = [];

    for (const line of icsText.split(/\r?/)) {
      if ((line.startsWith(" ") || line.startsWith("\t")) && unfoldedLines.length) {
        unfoldedLines[unfoldedLines.length - 1] += line.slice(1);
      } else {
        unfoldedLines.push(line);
      }
    }

    const importedItems: CommunityCalendarItem[] = [];
    let currentEvent: string[] = [];
    let insideEvent = false;

    for (const line of unfoldedLines) {
      const trimmed = line.trim();

      if (trimmed === "BEGIN:VEVENT") {
        insideEvent = true;
        currentEvent = [];
        continue;
      }

      if (trimmed === "END:VEVENT") {
        const fields: Record<string, string> = {};

        for (const eventLine of currentEvent) {
          const separatorIndex = eventLine.indexOf(":");

          if (separatorIndex === -1) continue;

          const rawKey = eventLine.slice(0, separatorIndex);
          const key = rawKey.split(";")[0].toUpperCase();
          const value = eventLine.slice(separatorIndex + 1);

          if (!fields[key]) {
            fields[key] = cleanIcsValue(value);
          }
        }

        const start = formatIcsDateTime(fields.DTSTART ?? "");
        const title = fields.SUMMARY || "Untitled Event";

        if (start.date) {
          importedItems.push({
            id: makeId(),
            title,
            date: start.date,
            time: start.time,
            location: fields.LOCATION ?? "",
            category: fields.CATEGORIES ?? "Community",
            details: fields.DESCRIPTION ?? "",
            url: fields.URL ?? "",
            active: true,
            source: "ics",
            importedFrom: filename,
          });
        }

        insideEvent = false;
        currentEvent = [];
        continue;
      }

      if (insideEvent) {
        currentEvent.push(line);
      }
    }

    return importedItems;
  }

  function handleIcsImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      const importedItems = parseIcsEvents(content, file.name);

      if (importedItems.length === 0) {
        setCommunityStatus("No usable events were found in that .ICS file.");
        return;
      }

      setCommunityCalendarForActiveShow((items) =>
        [...items, ...importedItems].sort((a, b) =>
          `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
        )
      );

      setCommunityStatus(
        `Imported ${importedItems.length} event${
          importedItems.length === 1 ? "" : "s"
        } from ${file.name}.`
      );
    };

    reader.readAsText(file);
    event.target.value = "";
  }


  async function resolveWeatherCoordinates(location: WeatherLocation) {
    const raw = location.location.trim();

    const latLonMatch = raw.match(
      /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/
    );

    if (latLonMatch) {
      return {
        latitude: latLonMatch[1],
        longitude: latLonMatch[2],
      };
    }

    let lookupUrl = "";

    if (/^\d{5}$/.test(raw)) {
      lookupUrl = `https://api.zippopotam.us/us/${encodeURIComponent(raw)}`;
    } else {
      const cityStateMatch = raw.match(/^(.+),\s*([A-Za-z]{2})$/);

      if (cityStateMatch) {
        const city = cityStateMatch[1].trim();
        const state = cityStateMatch[2].trim().toLowerCase();
        lookupUrl = `https://api.zippopotam.us/us/${state}/${encodeURIComponent(
          city
        )}`;
      }
    }

    if (!lookupUrl) {
      throw new Error("Use ZIP, City, ST, or latitude,longitude.");
    }

    const lookupResponse = await invoke<string>("fetch_url", { url: lookupUrl });
    const lookupData = JSON.parse(lookupResponse);
    const place = lookupData?.places?.[0];

    if (!place?.latitude || !place?.longitude) {
      throw new Error("Could not find coordinates for that weather location.");
    }

    return {
      latitude: String(place.latitude),
      longitude: String(place.longitude),
    };
  }

  function buildWeatherRead(location: WeatherLocation, forecastData: any) {
    const period = forecastData?.properties?.periods?.[0];

    if (!period) {
      return `${location.label}: Weather data came back, but no forecast period was available.`;
    }

    const name = period.name ? `${period.name}: ` : "";
    const temperature =
      period.temperature && period.temperatureUnit
        ? `${period.temperature} degrees ${period.temperatureUnit}`
        : "";
    const shortForecast = period.shortForecast || "";
    const wind =
      period.windSpeed || period.windDirection
        ? `Winds ${period.windDirection || ""} ${period.windSpeed || ""}.`
        : "";
    const detail = period.detailedForecast || "";

    return `${location.label}: ${name}${shortForecast}${
      temperature ? `, around ${temperature}` : ""
    }. ${wind} ${detail}`.replace(/\s+/g, " ").trim();
  }

  async function refreshWeatherLocation(location: WeatherLocation) {
    const coordinates = await resolveWeatherCoordinates(location);
    const pointsUrl = `https://api.weather.gov/points/${coordinates.latitude},${coordinates.longitude}`;

    const pointsResponse = await invoke<string>("fetch_url", { url: pointsUrl });
    const pointsData = JSON.parse(pointsResponse);
    const forecastUrl = pointsData?.properties?.forecast;

    if (!forecastUrl) {
      throw new Error("No forecast URL returned for that weather location.");
    }

    const forecastResponse = await invoke<string>("fetch_url", {
      url: forecastUrl,
    });
    const forecastData = JSON.parse(forecastResponse);

    return buildWeatherRead(location, forecastData);
  }

  async function refreshAllWeatherLocations() {
    if (!activeShow) return;

    const locations = activeWeatherLocations.filter((location) => location.active);

    if (locations.length === 0) {
      setWeatherStatus("No active weather locations for this show.");
      return;
    }

    setIsWeatherRefreshing(true);
    setWeatherStatus("Refreshing weather...");

    const updatedReads: Record<string, string> = {};
    const failures: string[] = [];

    for (const location of locations) {
      try {
        updatedReads[location.id] = await refreshWeatherLocation(location);
      } catch {
        failures.push(location.label);
      }
    }

    const nowIso = new Date().toISOString();

    setWeatherLocationsForActiveShow((currentLocations) =>
      currentLocations.map((location) =>
        updatedReads[location.id]
          ? {
              ...location,
              lastRead: updatedReads[location.id],
              lastUpdated: nowIso,
            }
          : location
      )
    );

    setIsWeatherRefreshing(false);

    const successCount = Object.keys(updatedReads).length;

    if (failures.length) {
      setWeatherStatus(
        `Updated ${successCount}. Could not refresh: ${failures.join(", ")}.`
      );
    } else {
      setWeatherStatus(
        `Updated ${successCount} weather location${
          successCount === 1 ? "" : "s"
        }.`
      );
    }
  }

  async function refreshAll() {
    await refreshRssFeeds();
    await refreshAllTrafficAreas();
    await refreshAllWeatherLocations();
  }


  function getMonthDayKey(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${month}-${day}`;
  }

  function getDayOfYear(date: Date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / 86400000);
  }

  function getDaysUntilChristmas(date: Date) {
    let christmas = new Date(date.getFullYear(), 11, 25);

    if (date > christmas) {
      christmas = new Date(date.getFullYear() + 1, 11, 25);
    }

    return Math.ceil(
      (christmas.getTime() - date.getTime()) / 86400000
    );
  }

  function getActiveHeaderBlocks(): HeaderBlockKind[] {
    const blocks = templateHeader.blocks ?? DEFAULT_HEADER_BLOCKS;
    return blocks.filter((block) => block !== "none").slice(0, 3);
  }

  function getFirstActiveWeatherRead() {
    const location = activeWeatherLocations.find((item) => item.active);
    return location?.lastRead || "Refresh weather to generate this block.";
  }

  function getFirstActiveTrafficRead() {
    const area = activeTrafficAreas.find((item) => item.active);
    return area?.lastRead || "Refresh traffic to generate this block.";
  }


  function cleanHeaderInfoText(value: string) {
    return value
      .replace(/<[^>]*>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function uniqueLimitedList(values: string[], limit = 6) {
    const seen = new Set<string>();
    const cleaned: string[] = [];

    for (const value of values) {
      const item = cleanHeaderInfoText(value)
        .replace(/^Today is\s+/i, "")
        .replace(/\s+\|\s+National Day Calendar.*$/i, "")
        .trim();

      const key = item.toLowerCase();

      if (!item || seen.has(key)) continue;
      if (item.length < 4 || item.length > 90) continue;

      seen.add(key);
      cleaned.push(item);

      if (cleaned.length >= limit) break;
    }

    return cleaned;
  }

  function extractNationalDaysFromHtml(html: string) {
    const candidates: string[] = [];

    const titleMatches = Array.from(
      html.matchAll(/(?:title|aria-label)=["']([^"']*National[^"']*Day[^"']*)["']/gi)
    );

    for (const match of titleMatches) {
      candidates.push(match[1]);
    }

    const headingMatches = Array.from(
      html.matchAll(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gis)
    );

    for (const match of headingMatches) {
      candidates.push(match[1]);
    }

    const linkMatches = Array.from(html.matchAll(/>([^<>]*National[^<>]*Day[^<>]*)</gi));

    for (const match of linkMatches) {
      candidates.push(match[1]);
    }

    return uniqueLimitedList(
      candidates.filter((item) => /National/i.test(item) && /Day/i.test(item)),
      6
    );
  }

  function extractBirthdaysFromWikimedia(data: unknown) {
    const parsed = data as {
      births?: Array<{
        year?: number;
        text?: string;
        pages?: Array<{ normalizedtitle?: string; title?: string }>;
      }>;
    };

    const births = Array.isArray(parsed.births) ? parsed.births : [];

    const names = births
      .map((birth) => {
        const pageTitle =
          birth.pages?.[0]?.normalizedtitle ||
          birth.pages?.[0]?.title?.replace(/_/g, " ") ||
          "";

        const textName =
          birth.text
            ?.replace(/^\d+\s*[-–]\s*/, "")
            .split(",")[0]
            .split(" (")[0]
            .trim() || "";

        const name = pageTitle || textName;

        if (!name) return "";

        return birth.year ? `${name} (${birth.year})` : name;
      })
      .filter(Boolean);

    return uniqueLimitedList(names, 8);
  }

  async function refreshLiveHeaderInfo() {
    const key = getMonthDayKey(now);
    const [month, day] = key.split("-");

    setLiveHeaderDateKey(key);

    try {
      const html = await invoke<string>("fetch_url", {
        url: "https://nationaldaycalendar.com/",
      });

      const nationalDays = extractNationalDaysFromHtml(html);

      setLiveNationalDays(
        nationalDays.length
          ? nationalDays
          : FUN_DAY_LOOKUP[key] || ["National Day Calendar did not return today’s list."]
      );
    } catch {
      setLiveNationalDays(
        FUN_DAY_LOOKUP[key] || ["National Day Calendar did not return today’s list."]
      );
    }

    try {
      const response = await invoke<string>("fetch_url", {
        url: `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/births/${month}/${day}`,
      });

      const birthdays = extractBirthdaysFromWikimedia(JSON.parse(response));

      setLiveBirthdays(
        birthdays.length
          ? birthdays
          : BIRTHDAY_LOOKUP[key] || ["Birthday source did not return today’s list."]
      );
    } catch {
      setLiveBirthdays(
        BIRTHDAY_LOOKUP[key] || ["Birthday source did not return today’s list."]
      );
    }
  }

  function getHeaderBlockData(block: HeaderBlockKind) {
    const key = getMonthDayKey(now);

    if (block === "date") {
      return {
        title: "Today Info",
        lines: [
          now.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
          now.toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          }),
          `Day ${getDayOfYear(now)} of ${now.getFullYear()}`,
          `${getDaysUntilChristmas(now)} days until Christmas`,
        ],
      };
    }

    if (block === "weather") {
      return {
        title: "Weather",
        lines: [getFirstActiveWeatherRead()],
      };
    }

    if (block === "traffic") {
      return {
        title: "Traffic",
        lines: [getFirstActiveTrafficRead()],
      };
    }

    if (block === "funDays") {
      return {
        title: "Today Is",
        lines:
          FUN_DAY_LOOKUP[key] ?? [
            "No built-in observances for today yet.",
          ],
      };
    }

    if (block === "birthdays") {
      return {
      title: "Birthdays",
      lines:
        liveHeaderDateKey === key && liveBirthdays.length
          ? liveBirthdays
          : BIRTHDAY_LOOKUP[key] || ["Loading today’s birthdays..."],
    };
  }

    return {
      title: "",
      lines: [],
    };
  }

  function renderHeaderBlocks() {
    const activeBlocks = getActiveHeaderBlocks();

    if (activeBlocks.length === 0) {
      return <div className="header-block-stack empty-header-block-stack" />;
    }

    return (
      <div className="header-block-stack">
        {activeBlocks.map((block, index) => {
          const blockData = getHeaderBlockData(block);

          return (
            <div className="today-card header-info-block" key={`${block}-${index}`}>
              <strong>{blockData.title}</strong>
              <div className="header-info-lines">
                {blockData.lines.map((line, lineIndex) => (
                  <span key={`${block}-${lineIndex}`}>{line}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (screen === "dashboard") {
    return (
      <main className="app-shell">
        <section className="dashboard-hero">
          <div>
            <img className="dashboard-logo" src="/prepdeck-logo.png" alt="PrepDeck" />
            <p className="eyebrow">PrepDeck</p>
            <h1>Choose a Show</h1>
            <p>
              Create shows, save templates for each show, and open a clean prep
              sheet every day.
            </p>
          </div>

          <button type="button" onClick={createShow}>
            Create New Show
          </button>
        </section>

        {showCreatorOpen ? (
          <section className="show-create-panel">
            <div className="show-create-header">
              <div>
                <p className="eyebrow">New Show</p>
                <h2>Create Show Profile</h2>
                <p>
                  This creates the show. After that, you can add as many templates
                  as needed for that show.
                </p>
              </div>

              <button type="button" onClick={() => setShowCreatorOpen(false)}>
                Cancel
              </button>
            </div>

            <div className="show-create-grid">
              <label>
                Show Name
                <input
                  value={showDraft.showName}
                  onChange={(event) =>
                    updateShowDraft("showName", event.target.value)
                  }
                  placeholder="Morning Show"
                />
              </label>

              <label>
                Initial Template Name
                <input
                  value={initialTemplateNameDraft}
                  onChange={(event) =>
                    setInitialTemplateNameDraft(event.target.value)
                  }
                  placeholder="Monday Template"
                />
              </label>

              <label>
                Host / DJ
                <input
                  value={showDraft.hostName}
                  onChange={(event) =>
                    updateShowDraft("hostName", event.target.value)
                  }
                  placeholder="Jimmy Hicks"
                />
              </label>

              <label>
                Station
                <input
                  value={showDraft.stationName}
                  onChange={(event) =>
                    updateShowDraft("stationName", event.target.value)
                  }
                  placeholder="US 51 Country"
                />
              </label>

              <label>
                Market
                <input
                  value={showDraft.market}
                  onChange={(event) =>
                    updateShowDraft("market", event.target.value)
                  }
                  placeholder="Tipton County / Lauderdale County"
                />
              </label>

              <label>
                Start Time
                <input
                  value={showDraft.showStart}
                  onChange={(event) =>
                    updateShowDraft("showStart", event.target.value)
                  }
                  placeholder="6:00 AM"
                />
              </label>

              <label>
                End Time
                <input
                  value={showDraft.showEnd}
                  onChange={(event) =>
                    updateShowDraft("showEnd", event.target.value)
                  }
                  placeholder="9:00 AM"
                />
              </label>

              <label>
                Text Line
                <input
                  value={showDraft.textLine}
                  onChange={(event) =>
                    updateShowDraft("textLine", event.target.value)
                  }
                  placeholder="Text line"
                />
              </label>

              <label>
                Phone / Contact Line
                <input
                  value={showDraft.phoneLine}
                  onChange={(event) =>
                    updateShowDraft("phoneLine", event.target.value)
                  }
                  placeholder="Studio line"
                />
              </label>
            </div>

            <div className="show-create-actions">
              <button type="button" onClick={saveNewShowFromForm}>
                Create Show and Open Workspace
              </button>
            </div>
          </section>
        ) : null}

        {shows.length === 0 ? (
          <section className="empty-state">
            <h2>No shows yet</h2>
            <p>
              Start by creating a show. Each show can have as many templates as
              needed.
            </p>
            <button type="button" onClick={createShow}>
              Create First Show
            </button>
          </section>
        ) : (
          <section className="show-grid">
            {shows.map((show) => (
              <article className="show-card" key={show.id}>
                <div className="show-card-top">
                  <div>
                    <h2>{show.name}</h2>
                    <p>{show.settings.hostName || "Host not set"}</p>
                  </div>

                  <div className="mini-actions">
                    <button type="button" onClick={() => renameShow(show.id)}>
                      Edit Show
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => deleteShow(show.id)}
                    >
                      {pendingDeleteShowId === show.id ? "Confirm Delete" : "Delete"}
                    </button>
                  </div>
                </div>

                <div className="show-meta">
                  <span>{show.settings.stationName || "Station not set"}</span>
                  <span>{show.settings.market || "Market not set"}</span>
                  <span>
                    {show.settings.showStart}–{show.settings.showEnd}
                  </span>
                  <span>{getFeedsForShow(show).length} RSS feeds</span>
                </div>

                {editingShowId === show.id ? (
                  <div className="inline-show-editor">
                    <div className="inline-editor-grid">
                      <label>
                        Show Name
                        <input
                          value={editShowDraft.showName}
                          onChange={(event) =>
                            updateEditShowDraft("showName", event.target.value)
                          }
                        />
                      </label>

                      <label>
                        Host / DJ
                        <input
                          value={editShowDraft.hostName}
                          onChange={(event) =>
                            updateEditShowDraft("hostName", event.target.value)
                          }
                        />
                      </label>

                      <label>
                        Station
                        <input
                          value={editShowDraft.stationName}
                          onChange={(event) =>
                            updateEditShowDraft("stationName", event.target.value)
                          }
                        />
                      </label>

                      <label>
                        Market
                        <input
                          value={editShowDraft.market}
                          onChange={(event) =>
                            updateEditShowDraft("market", event.target.value)
                          }
                        />
                      </label>

                      <label>
                        Start Time
                        <input
                          value={editShowDraft.showStart}
                          onChange={(event) =>
                            updateEditShowDraft("showStart", event.target.value)
                          }
                        />
                      </label>

                      <label>
                        End Time
                        <input
                          value={editShowDraft.showEnd}
                          onChange={(event) =>
                            updateEditShowDraft("showEnd", event.target.value)
                          }
                        />
                      </label>

                      <label>
                        Text Line
                        <input
                          value={editShowDraft.textLine}
                          onChange={(event) =>
                            updateEditShowDraft("textLine", event.target.value)
                          }
                        />
                      </label>

                      <label>
                        Phone / Contact
                        <input
                          value={editShowDraft.phoneLine}
                          onChange={(event) =>
                            updateEditShowDraft("phoneLine", event.target.value)
                          }
                        />
                      </label>
                    </div>

                    <div className="inline-editor-actions">
                      <button type="button" onClick={() => saveShowEdits(show.id)}>
                        Save Show
                      </button>
                      <button type="button" onClick={cancelShowEdit}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="template-section">
                  <div className="template-section-title">
                    <strong>Templates</strong>
                    <button type="button" onClick={() => createTemplate(show.id)}>
                      Add Template
                    </button>
                  </div>

                  {templateCreatorShowId === show.id ? (
                    <div className="inline-template-create">
                      <label>
                        Template Name
                        <input
                          value={templateNameDraft}
                          onChange={(event) =>
                            setTemplateNameDraft(event.target.value)
                          }
                          placeholder="Monday Template"
                        />
                      </label>

                      <div className="inline-editor-actions">
                        <button
                          type="button"
                          onClick={() => saveNewTemplateFromForm(show.id)}
                        >
                          Save Template
                        </button>
                        <button type="button" onClick={cancelTemplateCreate}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {show.templates.length === 0 ? (
                    <p className="small-muted">No templates yet.</p>
                  ) : (
                    show.templates.map((template) => (
                      <div className="template-row" key={template.id}>
                        <div>
                          <strong>{template.name}</strong>
                          <span>{template.breaks.length} break blocks saved</span>
                        </div>

                        <div className="template-actions">
                          <button
                            type="button"
                            onClick={() => openTemplate(show, template)}
                          >
                            Edit Template
                          </button>

                            <button
                              type="button"
                              onClick={() => startDailyPrepFromShowCard(show.id, template.id)}
                            >
                              Start Today's Prep
                            </button>
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => deleteTemplate(show.id, template.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    );
  }

  if (screen === "daily") {
    const selectedRssFeed = activeFeeds.find(
      (feed) => feed.id === activeRssFeedId
    );

    const visibleRssStories =
      activeRssFeedId === "all"
        ? storyBank
        : storyBank.filter((story) => {
            return (
              story.feedId === activeRssFeedId ||
              story.feedName === selectedRssFeed?.name ||
              story.category === selectedRssFeed?.category ||
              story.category === selectedRssFeed?.name
            );
          });

    return (
      <main className="app-shell">
        <header className="workspace-header daily-prep-header">
          <div className="app-mark">
            <img className="prepdeck-brand-logo" src="/prepdeck-logo.png" alt="PrepDeck" />
          </div>

          <div className="show-info">
            <p className="eyebrow">Daily Prep</p>
            <h1>{settings.showName || "Daily Prep"}</h1>
            <p>
              <strong>{activeTemplate ? activeTemplate.name : "Template"}</strong>{" "}
              • {formatCurrentShowDate(now)}.
            </p>
            <p>
              {settings.stationName || "Station not set"}
              {settings.market ? ` • ${settings.market}` : ""}
            </p>
          </div>

          {renderHeaderBlocks()}
        </header>

        <section className="workspace-toolbar">
          <div className="daily-toolbar-fields">
            <label>
              Station Priority
              <input
                value={dailyStationPriority}
                onChange={(event) =>
                  setDailyStationPriority(event.target.value)
                }
                placeholder="Main thing the station needs pushed today..."
              />
            </label>

            <label>
              Contest Reminder
              <input
                value={dailyContestReminder}
                onChange={(event) =>
                  setDailyContestReminder(event.target.value)
                }
                placeholder="Contest, giveaway, caller number, sponsor note..."
              />
            </label>
          </div>

          <div className="toolbar-actions">
            <button type="button" onClick={() => setScreen("dashboard")}>
              Back to Shows
            </button>
            <button type="button" onClick={() => setScreen("workspace")}>
              Edit Template
            </button>
            <button type="button" onClick={refreshDailySources}>
              Refresh Sources
            </button>
          </div>
        </section>

        <section className="daily-prep-layout daily-content-left">
          <aside className="daily-content-bank">
            <div className="content-bank-header">
              <div>
                <p className="eyebrow">Daily Content</p>
                <h2>Content Bank</h2>
              </div>

              <button type="button" onClick={refreshDailySources}>
                Refresh
              </button>
            </div>

            <label className="daily-break-picker">
              Add items to break
              <select
                value={dailySelectedBreakId}
                onChange={(event) => setDailySelectedBreakId(event.target.value)}
              >
                {dailyStationPriority || dailyContestReminder ? (
                  <section className="print-priority-strip">
                    {dailyStationPriority ? (
                      <div>
                        <strong>Station Priority</strong>
                        <span>{dailyStationPriority}</span>
                      </div>
                    ) : null}

                    {dailyContestReminder ? (
                      <div>
                        <strong>Contest Reminder</strong>
                        <span>{dailyContestReminder}</span>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {dailyBreaks.map((block) => (
                  <option key={block.id} value={block.id}>
                    {block.time} — {block.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="daily-content-tabs">
              <button
                type="button"
                className={activeDailyContentTab === "rss" ? "active" : ""}
                onClick={() => setActiveDailyContentTab("rss")}
              >
                RSS
              </button>
              <button
                type="button"
                className={activeDailyContentTab === "traffic" ? "active" : ""}
                onClick={() => setActiveDailyContentTab("traffic")}
              >
                Traffic
              </button>
              <button
                type="button"
                className={activeDailyContentTab === "weather" ? "active" : ""}
                onClick={() => setActiveDailyContentTab("weather")}
              >
                Weather
              </button>
              <button
                type="button"
                className={activeDailyContentTab === "community" ? "active" : ""}
                onClick={() => setActiveDailyContentTab("community")}
              >
                Calendar
              </button>
            </div>

            {activeDailyContentTab === "rss" ? (
              <div className="daily-bank-section">
                <div className="daily-bank-section-title">
                  <h3>RSS Stories</h3>
                  <button
                    type="button"
                    onClick={refreshRssFeeds}
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? "Refreshing..." : "Refresh RSS"}
                  </button>
                </div>

                <div className="rss-filter-row">
                  <button
                    type="button"
                    className={activeRssFeedId === "all" ? "active" : ""}
                    onClick={() => setActiveRssFeedId("all")}
                  >
                    All Feeds
                  </button>

                  {activeFeeds.map((feed) => (
                    <button
                      type="button"
                      key={feed.id}
                      className={activeRssFeedId === feed.id ? "active" : ""}
                      onClick={() => setActiveRssFeedId(feed.id)}
                    >
                      {feed.name}
                    </button>
                  ))}
                </div>

                {feedStatus ? <p className="status-line">{feedStatus}</p> : null}

                {visibleRssStories.length === 0 ? (
                  <p className="small-muted">No RSS stories loaded for this view.</p>
                ) : (
                  <div className="daily-source-list">
                    {visibleRssStories.map((story) => (
                      <div className="daily-source-row" key={story.id}>
                        <div>
                          <strong>{story.title}</strong>
                          <span>{story.feedName}</span>
                          {story.summary ? <p>{story.summary}</p> : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => addRssStoryToDailyBreak(story)}
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {activeDailyContentTab === "traffic" ? (
              <div className="daily-bank-section">
                <div className="daily-bank-section-title">
                  <h3>Traffic</h3>
                  <button
                    type="button"
                    onClick={refreshAllTrafficAreas}
                    disabled={isTrafficRefreshing}
                  >
                    {isTrafficRefreshing ? "Refreshing..." : "Refresh Traffic"}
                  </button>
                </div>

                {trafficStatus ? <p className="status-line">{trafficStatus}</p> : null}

                {activeTrafficAreas.filter((area) => area.active).length === 0 ? (
                  <p className="small-muted">No active traffic areas saved.</p>
                ) : (
                  <div className="daily-source-list">
                    {activeTrafficAreas
                      .filter((area) => area.active)
                      .map((area) => (
                        <div className="daily-source-row" key={area.id}>
                          <div>
                            <strong>{area.label}</strong>
                            <span>
                              {area.lastRead
                                ? "Traffic read ready"
                                : "Refresh traffic first"}
                            </span>
                            {area.lastRead ? <p>{area.lastRead}</p> : null}
                          </div>

                          <button
                            type="button"
                            onClick={() => addTrafficReadToDailyBreak(area)}
                          >
                            Add
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ) : null}

            {activeDailyContentTab === "weather" ? (
              <div className="daily-bank-section">
                <div className="daily-bank-section-title">
                  <h3>Weather</h3>
                  <button
                    type="button"
                    onClick={refreshAllWeatherLocations}
                    disabled={isWeatherRefreshing}
                  >
                    {isWeatherRefreshing ? "Refreshing..." : "Refresh Weather"}
                  </button>
                </div>

                {weatherStatus ? <p className="status-line">{weatherStatus}</p> : null}

                {activeWeatherLocations.filter((location) => location.active).length ===
                0 ? (
                  <p className="small-muted">No active weather locations saved.</p>
                ) : (
                  <div className="daily-source-list">
                    {activeWeatherLocations
                      .filter((location) => location.active)
                      .map((location) => (
                        <div className="daily-source-row" key={location.id}>
                          <div>
                            <strong>{location.label}</strong>
                            <span>
                              {location.lastRead
                                ? "Weather read ready"
                                : `Refresh weather for ${location.location}`}
                            </span>
                            {location.lastRead ? <p>{location.lastRead}</p> : null}
                          </div>

                          <button
                            type="button"
                            onClick={() => addWeatherLocationToDailyBreak(location)}
                          >
                            Add
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ) : null}

            {activeDailyContentTab === "community" ? (
              <div className="daily-bank-section">
                <h3>Community Calendar</h3>

                {activeCommunityItems.filter((item) => item.active).length === 0 ? (
                  <p className="small-muted">No active calendar items saved.</p>
                ) : (
                  <div className="daily-source-list">
                    {activeCommunityItems
                      .filter((item) => item.active)
                      .map((item) => (
                        <div className="daily-source-row" key={item.id}>
                          <div>
                            <strong>{item.title}</strong>
                            <span>
                              {item.date}
                              {item.time ? ` at ${item.time}` : ""}
                            </span>
                            {item.details ? <p>{item.details}</p> : null}
                          </div>

                          <button
                            type="button"
                            onClick={() => addCommunityItemToDailyBreak(item)}
                          >
                            Add
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ) : null}
          </aside>

          <section className="prep-board daily-break-board">
            <div className="prep-board-title daily-break-title">
              <div>
                <h2>Today's Breaks</h2>
                <p>Build today’s breaks.</p>
              </div>

              <div className="daily-break-actions">
                <button type="button" onClick={() => setPreviewOpen(true)}>
            Save Sheet
          </button>
          <button type="button" onClick={() => setPreviewOpen(true)}>
            Preview
          </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewOpen(true);
                    window.setTimeout(() => window.print(), 150);
                  }}
                >
                  Print
                </button>
              </div>
            </div>

            {dailyBreaks.length === 0 ? (
              <p className="small-muted">
                This template does not have any break blocks yet.
              </p>
            ) : (
              <div className="break-list">
                {dailyBreaks.map((block) => (
                  <article className="break-card" key={block.id}>
                    <div className="break-card-top">
                      <input className="break-time" value={block.time} readOnly />
                      <input className="break-title" value={block.title} readOnly />

                      <button
                        type="button"
                        onClick={() => openDailyNoteForm(block.id)}
                      >
                        Add Note
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openDailyBreakOptionForm(block.id, "Show Focus")
                        }
                      >
                        Add Focus
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openDailyBreakOptionForm(block.id, "Tease / Promo")
                        }
                      >
                        Add Tease
                      </button>
                    </div>

                    {dailyNoteCreatorBreakId === block.id ? (
                      <div className="inline-note-create">
                        <div className="inline-note-grid">
                          <label>
                            Note Title
                            <input
                              value={dailyNoteDraft.title}
                              onChange={(event) =>
                                updateDailyNoteDraft("title", event.target.value)
                              }
                              placeholder="Host Note"
                            />
                          </label>

                          <label>
                            Note
                            <textarea
                              value={dailyNoteDraft.body}
                              onChange={(event) =>
                                updateDailyNoteDraft("body", event.target.value)
                              }
                              placeholder="Type the note for this break..."
                            />
                          </label>
                        </div>

                        <div className="inline-note-actions">
                          <button
                            type="button"
                            onClick={() => saveDailyNoteToBreak(block.id)}
                          >
                            Save Note
                          </button>
                          <button type="button" onClick={cancelDailyNoteCreate}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {dailyBreakOptionDraft.blockId === block.id ? (
                      <div className="inline-break-option-create">
                        <div className="inline-note-grid">
                          <label>
                            Item Title
                            <input
                              value={dailyBreakOptionDraft.title}
                              onChange={(event) =>
                                updateDailyBreakOptionDraft(
                                  "title",
                                  event.target.value
                                )
                              }
                              placeholder={dailyBreakOptionDraft.type}
                            />
                          </label>

                          <label>
                            Details
                            <textarea
                              value={dailyBreakOptionDraft.body}
                              onChange={(event) =>
                                updateDailyBreakOptionDraft(
                                  "body",
                                  event.target.value
                                )
                              }
                              placeholder={
                                dailyBreakOptionDraft.type === "Show Focus"
                                  ? "Main focus for this break..."
                                  : "What should be teased or promoted in this break..."
                              }
                            />
                          </label>
                        </div>

                        <div className="inline-note-actions">
                          <button
                            type="button"
                            onClick={saveDailyBreakOptionToBreak}
                          >
                            Save {dailyBreakOptionDraft.type || "Item"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelDailyBreakOptionCreate}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {block.items.length === 0 ? (
                      <p className="small-muted">
                        Nothing added to this break yet.
                      </p>
                    ) : (
                      <div className="prep-items">
                        {block.items.map((item) => (
                          <div className="prep-item" key={item.id}>
                            <div>
                              <strong>
                                {item.type}: {item.title}
                              </strong>
                              {item.body ? <p>{item.body}</p> : null}
                            </div>

                            <button
                              type="button"
                              className="danger-button"
                              onClick={() =>
                                removeDailyItemFromBreak(block.id, item.id)
                              }
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>

        {previewOpen ? (
          <div className="modal-backdrop print-preview-backdrop">
            <section className="modal-card daily-print-preview-card">
              <div className="modal-header print-preview-actions">
                <div>
                  <p className="eyebrow">Preview</p>
                  <h2>{settings.showName || "Daily Prep"}</h2>
                </div>

                <div className="feed-manager-actions">
                  <button type="button" onClick={() => window.print()}>
                    Print
                  </button>
                  <button type="button" onClick={() => setPreviewOpen(false)}>
                    Close
                  </button>
                </div>
              </div>

              <div className="print-sheet">
                <header className="print-sheet-header">
                  <div>
                    <h1>{settings.showName || "Daily Prep"}</h1>
                    <p>
                      {activeTemplate ? activeTemplate.name : "Template"} •{" "}
                      {new Date().toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <p>
                      {settings.stationName || ""}
                      {settings.market ? ` • ${settings.market}` : ""}
                      {settings.hostName ? ` • ${settings.hostName}` : ""}
                    </p>
                    {settings.textLine || settings.phoneLine ? (
                      <p>
                        {settings.textLine ? `Text: ${settings.textLine}` : ""}
                        {settings.textLine && settings.phoneLine ? " • " : ""}
                        {settings.phoneLine ? `Phone: ${settings.phoneLine}` : ""}
                      </p>
                    ) : null}
                  </div>

                  <div className="print-header-blocks">
                    {getActiveHeaderBlocks().map((block, index) => {
                      const blockData = getHeaderBlockData(block);

                      return (
                        <div className="print-header-block" key={`${block}-${index}`}>
                          <strong>{blockData.title}</strong>
                          <div className="print-header-lines">
                            {blockData.lines.map((line, lineIndex) => (
                              <span key={`${block}-${lineIndex}`}>{line}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </header>

              {dailyStationPriority || dailyContestReminder ? (
                <section className="print-priority-under-title">
                  {dailyStationPriority ? (
                    <div>
                      <strong>Station Priority</strong>
                      <span>{dailyStationPriority}</span>
                    </div>
                  ) : null}

                  {dailyContestReminder ? (
                    <div>
                      <strong>Contest Reminder</strong>
                      <span>{dailyContestReminder}</span>
                    </div>
                  ) : null}
                </section>
              ) : null}


                {dailyBreaks.map((block) => (
                  <section className="print-break" key={block.id}>
                    <h2>
                      {block.time} — {block.title}
                    </h2>

                    {block.items.length === 0 ? (
                      <p className="print-empty">No items.</p>
                    ) : (
                      block.items.map((item) => (
                        <article className="print-item" key={item.id}>
                          <h3>
                            {item.type}: {item.title}
                          </h3>
                          {item.body ? <p>{item.body}</p> : null}
                          {item.url ? <small>{item.url}</small> : null}
                        </article>
                      ))
                    )}
                  </section>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </main>
    );
  }


  return (
    <main className="app-shell">
      <header className="workspace-header">
        <div className="app-mark">
            <img className="prepdeck-brand-logo" src="/prepdeck-logo.png" alt="PrepDeck" />
          </div>

        <div className="show-info">
          <p className="eyebrow"></p>
          <h1>{settings.showName || "Untitled Show"}</h1>
          <p>
            {settings.stationName || "Station"} • {settings.market || "Market"} •{" "}
            {settings.showStart}–{settings.showEnd}
          </p>
          <p>
            <strong>Text:</strong> {settings.textLine || "Not set"} •{" "}
            <strong>Phone:</strong> {settings.phoneLine || "Not set"}
          </p>
        </div>

          {renderHeaderBlocks()}
        </header>

      <section className="workspace-toolbar">
        <div>
          <strong>{activeShow?.name}</strong>
          <span>
            {activeTemplate
              ? `Template Builder: ${activeTemplate.name}`
              : "Template Builder"}
          </span>
        </div>

        <div className="toolbar-actions">
          <button type="button" onClick={() => setScreen("dashboard")}>
            Back to Shows
          </button>
          <button type="button" onClick={refreshAll} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing..." : "Refresh All"}
          </button>
          <button type="button" onClick={startNewBlankDay}>
            Clear Template Items
          </button>
            <button type="button" onClick={startDailyPrepFromCurrentTemplate}>
              Start Today’s Prep
            </button>

          <button type="button" onClick={saveSetupToTemplate}>
            Save Setup to Template
          </button>
        </div>
      </section>

      <section className="content-feeds-panel">
        <div className="content-feeds-header">
          <div>
            <p className="eyebrow">Show-Level Sources</p>
            <h2>Content Feeds</h2>
          </div>

          <button type="button" onClick={refreshAll}>
            Refresh
          </button>
        </div>

        <div className="source-tabs">
          <button
            type="button"
            className={activeSourceTab === "rss" ? "active" : ""}
            onClick={() => setActiveSourceTab("rss")}
          >
            RSS <span>{activeFeedCount}</span>
          </button>

          <button
            type="button"
            className={activeSourceTab === "traffic" ? "active" : ""}
            onClick={() => setActiveSourceTab("traffic")}
          >
            Traffic <span>{activeTrafficCount}</span>
          </button>

          <button
            type="button"
            className={activeSourceTab === "weather" ? "active" : ""}
            onClick={() => setActiveSourceTab("weather")}
          >
            Weather <span>{activeWeatherCount}</span>
          </button>

          <button
            type="button"
            className={activeSourceTab === "community" ? "active" : ""}
            onClick={() => setActiveSourceTab("community")}
          >
            Calendar <span>{activeCommunityCount}</span>
          </button>

          <button
            type="button"
            className={activeSourceTab === "header" ? "active" : ""}
            onClick={() => setActiveSourceTab("header")}
          >
            Header <span>{getActiveHeaderBlocks().length}</span>
          </button>
        </div>

        {activeSourceTab === "rss" ? (
          <div className="source-tab-panel">
            <div className="source-tab-top">
              <div>
                <h3>RSS Feeds</h3>
                <p>Manage this show’s content feeds.</p>
              </div>

              <div className="tool-card-actions">
                <button type="button" onClick={() => setFeedManagerOpen(true)}>
                  Manage Feeds
                </button>
                <button type="button" onClick={refreshRssFeeds} disabled={isRefreshing}>
                  {isRefreshing ? "Refreshing..." : "Refresh RSS"}
                </button>
              </div>
            </div>

            {feedStatus ? <p className="status-line">{feedStatus}</p> : null}

            <div className="feed-pill-list compact-feed-list">
              {activeFeeds.map((feed) => (
                <span key={feed.id} className={feed.active ? "" : "inactive"}>
                  {feed.name}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {activeSourceTab === "traffic" ? (
          <div className="source-tab-panel">
            <div className="source-tab-top">
              <div>
                <h3>TomTom Traffic</h3>
                <p>Save the API key and traffic checkpoints for this show.</p>
              </div>

              <button
                type="button"
                onClick={refreshAllTrafficAreas}
                disabled={isTrafficRefreshing}
              >
                {isTrafficRefreshing ? "Refreshing..." : "Refresh Traffic"}
              </button>
            </div>

            <label className="api-key-field">
              TomTom API Key
              <input
                value={tomTomApiKey}
                onChange={(event) => setTomTomApiKey(event.target.value)}
                placeholder="Paste TomTom API key here"
              />
            </label>

            <div className="traffic-draft-grid">
              <label>
                Traffic Area
                <input
                  value={trafficDraft.label}
                  onChange={(event) =>
                    updateTrafficDraft("label", event.target.value)
                  }
                  placeholder="Highway 51"
                />
              </label>

              <label>
                Latitude
                <input
                  value={trafficDraft.latitude}
                  onChange={(event) =>
                    updateTrafficDraft("latitude", event.target.value)
                  }
                  placeholder="35.5642"
                />
              </label>

              <label>
                Longitude
                <input
                  value={trafficDraft.longitude}
                  onChange={(event) =>
                    updateTrafficDraft("longitude", event.target.value)
                  }
                  placeholder="-89.6465"
                />
              </label>

              <label>
                Description
                <input
                  value={trafficDraft.description}
                  onChange={(event) =>
                    updateTrafficDraft("description", event.target.value)
                  }
                  placeholder="Morning commute"
                />
              </label>
            </div>

            <div className="traffic-actions-row">
              <button type="button" onClick={addTrafficArea}>
                Add Traffic Area
              </button>
            </div>

            {trafficStatus ? <p className="status-line">{trafficStatus}</p> : null}

            <div className="traffic-area-list">
              {activeTrafficAreas.map((area) => (
                <div className="traffic-area-row" key={area.id}>
                  <div>
                    <strong>{area.label}</strong>
                    <span>
                      {area.latitude}, {area.longitude}
                    </span>
                    {area.description ? <small>{area.description}</small> : null}
                    {area.lastRead ? <p>{area.lastRead}</p> : null}
                  </div>

                  <div className="feed-manager-actions">
                    <button type="button" onClick={() => toggleTrafficArea(area.id)}>
                      {area.active ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => deleteTrafficArea(area.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeSourceTab === "weather" ? (
          <div className="source-tab-panel">
            <div className="source-tab-top">
              <div>
                <h3>Weather</h3>
                <p>Save weather locations for this show.</p>
              </div>
            </div>

            <div className="weather-draft-grid">
              <label>
                Weather Label
                <input
                  value={weatherDraft.label}
                  onChange={(event) =>
                    updateWeatherDraft("label", event.target.value)
                  }
                  placeholder="Home Market"
                />
              </label>

              <label>
                ZIP / City
                <input
                  value={weatherDraft.location}
                  onChange={(event) =>
                    updateWeatherDraft("location", event.target.value)
                  }
                  placeholder="Covington, TN or 38019"
                />
              </label>
            </div>

            <div className="traffic-actions-row">
              <button type="button" onClick={addWeatherLocation}>
                Add Weather Location
              </button>
            </div>

            <div className="traffic-area-list">
              {activeWeatherLocations.map((location) => (
                <div className="traffic-area-row" key={location.id}>
                  <div>
                    <strong>{location.label}</strong>
                    <span>{location.location}</span>
                  </div>

                  <div className="feed-manager-actions">
                    <button
                      type="button"
                      onClick={() => toggleWeatherLocation(location.id)}
                    >
                      {location.active ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => deleteWeatherLocation(location.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}


        {activeSourceTab === "community" ? (
          <div className="source-tab-panel">
            <div className="source-tab-top">
              <div>
                <h3>Community Calendar</h3>
                <p>Add items manually or import an .ICS calendar file.</p>
              </div>

              <label className="ics-upload-button">
                Import .ICS
                <input type="file" accept=".ics,text/calendar" onChange={handleIcsImport} />
              </label>
            </div>

            <div className="community-draft-grid">
              <label>
                Title
                <input
                  value={communityDraft.title}
                  onChange={(event) =>
                    updateCommunityDraft("title", event.target.value)
                  }
                  placeholder="County Fair"
                />
              </label>

              <label>
                Date
                <input
                  type="date"
                  value={communityDraft.date}
                  onChange={(event) =>
                    updateCommunityDraft("date", event.target.value)
                  }
                />
              </label>

              <label>
                Time
                <input
                  value={communityDraft.time}
                  onChange={(event) =>
                    updateCommunityDraft("time", event.target.value)
                  }
                  placeholder="6:00 PM"
                />
              </label>

              <label>
                Category
                <input
                  value={communityDraft.category}
                  onChange={(event) =>
                    updateCommunityDraft("category", event.target.value)
                  }
                  placeholder="Community"
                />
              </label>

              <label>
                Location
                <input
                  value={communityDraft.location}
                  onChange={(event) =>
                    updateCommunityDraft("location", event.target.value)
                  }
                  placeholder="Town Square"
                />
              </label>

              <label>
                URL
                <input
                  value={communityDraft.url}
                  onChange={(event) =>
                    updateCommunityDraft("url", event.target.value)
                  }
                  placeholder="https://..."
                />
              </label>

              <label className="community-details-field">
                Details
                <textarea
                  value={communityDraft.details}
                  onChange={(event) =>
                    updateCommunityDraft("details", event.target.value)
                  }
                  placeholder="Short details for the event..."
                />
              </label>
            </div>

            <div className="traffic-actions-row">
              <button type="button" onClick={addCommunityItem}>
                Add Calendar Item
              </button>
            </div>

            {communityStatus ? (
              <p className="status-line">{communityStatus}</p>
            ) : null}

            {activeCommunityItems.length === 0 ? (
              <p className="small-muted">No community calendar items saved for this show.</p>
            ) : (
              <div className="community-item-list">
                {activeCommunityItems.map((item) => (
                  <div className="community-item-row" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>
                        {item.date}
                        {item.time ? ` at ${item.time}` : ""}
                        {item.location ? ` • ${item.location}` : ""}
                      </span>
                      <small>
                        {item.category} • {item.source === "ics" ? "Imported .ICS" : "Manual"}
                      </small>
                      {item.details ? <p>{item.details}</p> : null}
                    </div>

                    <div className="feed-manager-actions">
                      <button
                        type="button"
                        onClick={() => toggleCommunityItem(item.id)}
                      >
                        {item.active ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => deleteCommunityItem(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
        {activeSourceTab === "header" ? (
          <div className="source-tab-panel">
            <div className="source-tab-top">
              <div>
                <h3>Header Blocks</h3>
                <p>Add up to three horizontal blocks to the show header.</p>
              </div>
            </div>

            <div className="action-row">
              <button type="button" onClick={refreshLiveHeaderInfo}>
                Refresh Header Info
              </button>
            </div>

            <div className="header-option-list">
              {HEADER_BLOCK_OPTIONS.filter((option) => option.value !== "none").map(
                (option) => {
                  const activeBlocks = getActiveHeaderBlocks();
                  const isAdded = activeBlocks.includes(option.value as HeaderBlockKind);
                  const limitReached = activeBlocks.length >= 3 && !isAdded;

                  return (
                    <div className="header-option-row" key={option.value}>
                      <div>
                        <strong>{option.label}</strong>
                        <span>{getHeaderOptionDescription(option.value)}</span>
                      </div>

                      <button
                        type="button"
                        disabled={isAdded || limitReached}
                        onClick={() => addHeaderBlockToTemplate(option.value)}
                      >
                        {isAdded ? "Added" : "Add to Header"}
                      </button>
                    </div>
                  );
                }
              )}
            </div>

            <div className="selected-header-blocks">
              <div className="selected-header-title">
                <strong>Current Header</strong>
                <span>{getActiveHeaderBlocks().length}/3 blocks added</span>
              </div>

              {getActiveHeaderBlocks().length === 0 ? (
                <p className="small-muted">No header blocks selected.</p>
              ) : (
                <div className="selected-header-list">
                  {getActiveHeaderBlocks().map((block, index) => {
                    const blockData = getHeaderBlockData(block);

                    return (
                      <div className="selected-header-row" key={`${block}-${index}`}>
                        <div>
                          <strong>{blockData.title}</strong>
                          <span>{blockData.lines.join(" • ")}</span>
                        </div>

                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => removeHeaderBlockFromTemplate(index)}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </section>

      <section className="settings-card">
        <h2>Show Information</h2>

        <div className="settings-grid">
          <label>
            Show Name
            <input
              value={settings.showName}
              onChange={(event) => updateSetting("showName", event.target.value)}
            />
          </label>

          <label>
            Host / DJ
            <input
              value={settings.hostName}
              onChange={(event) => updateSetting("hostName", event.target.value)}
            />
          </label>

          <label>
            Station
            <input
              value={settings.stationName}
              onChange={(event) => updateSetting("stationName", event.target.value)}
            />
          </label>

          <label>
            Market
            <input
              value={settings.market}
              onChange={(event) => updateSetting("market", event.target.value)}
            />
          </label>

          <label>
            Start Time
            <input
              value={settings.showStart}
              onChange={(event) => updateSetting("showStart", event.target.value)}
            />
          </label>

          <label>
            End Time
            <input
              value={settings.showEnd}
              onChange={(event) => updateSetting("showEnd", event.target.value)}
            />
          </label>

          <label>
            Text Line
            <input
              value={settings.textLine}
              onChange={(event) => updateSetting("textLine", event.target.value)}
            />
          </label>

          <label>
            Phone / Contact Line
            <input
              value={settings.phoneLine}
              onChange={(event) => updateSetting("phoneLine", event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="prep-board">
        <div className="prep-board-title">
          <div>
            <h2>Break Structure</h2>
            <p>
              Add the break times once, then save them to the template. Daily
              notes clear when you open a blank day.
            </p>
          </div>

          <button type="button" onClick={addBreakBlock}>
            Add Break Block
          </button>
        </div>

        {breakCreatorOpen ? (
          <div className="inline-break-create">
            <div className="inline-break-grid">
              <label>
                Break Time
                <input
                  value={breakDraft.time}
                  onChange={(event) =>
                    updateBreakDraft("time", event.target.value)
                  }
                  placeholder="6:08 AM"
                />
              </label>

              <label>
                Break Title
                <input
                  value={breakDraft.title}
                  onChange={(event) =>
                    updateBreakDraft("title", event.target.value)
                  }
                  placeholder="First Break"
                />
              </label>
            </div>

            <div className="inline-break-actions">
              <button type="button" onClick={saveBreakBlockFromForm}>
                Save Break
              </button>
              <button type="button" onClick={cancelBreakCreate}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {breaks.length === 0 ? (
          <div className="empty-state compact">
            <h2>No break blocks yet</h2>
            <p>Add the show’s break times, then save this setup to the template.</p>
          </div>
        ) : (
          <div className="break-list">
            {breaks.map((block) => (
              <article className="break-card" key={block.id}>
                <div className="break-card-top">
                  <input
                    className="break-time"
                    value={block.time}
                    onChange={(event) =>
                      updateBreak(block.id, "time", event.target.value)
                    }
                  />

                  <input
                    className="break-title"
                    value={block.title}
                    onChange={(event) =>
                      updateBreak(block.id, "title", event.target.value)
                    }
                  />

                  <button type="button" onClick={() => addNoteToBreak(block.id)}>
                    Add Note
                  </button>

                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => deleteBreak(block.id)}
                  >
                    Delete
                  </button>
                </div>

                {noteCreatorBreakId === block.id ? (
                  <div className="inline-note-create">
                    <div className="inline-note-grid">
                      <label>
                        Note Title
                        <input
                          value={noteDraft.title}
                          onChange={(event) =>
                            updateNoteDraft("title", event.target.value)
                          }
                          placeholder="Host Note"
                        />
                      </label>

                      <label>
                        Note
                        <textarea
                          value={noteDraft.body}
                          onChange={(event) =>
                            updateNoteDraft("body", event.target.value)
                          }
                          placeholder="Type the note for this break..."
                        />
                      </label>
                    </div>

                    <div className="inline-note-actions">
                      <button
                        type="button"
                        onClick={() => saveNoteToBreak(block.id)}
                      >
                        Save Note
                      </button>
                      <button type="button" onClick={cancelNoteCreate}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {block.items.length === 0 ? (
                  <p className="small-muted">No notes or default items in this break yet.</p>
                ) : (
                  <div className="prep-items">
                    {block.items.map((item) => (
                      <div className="prep-item" key={item.id}>
                        <div>
                          <strong>{item.title}</strong>
                          {item.body ? <p>{item.body}</p> : null}
                        </div>

                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => deleteItem(block.id, item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {feedManagerOpen ? (
        <div className="modal-backdrop">
          <section className="modal-card">
            <div className="modal-header">
              <div>
                <p className="eyebrow">RSS Management</p>
                <h2>Manage RSS Feeds</h2>
              </div>

              <button type="button" onClick={() => setFeedManagerOpen(false)}>
                Close
              </button>
            </div>

            <p className="helper-note">
              Need an RSS feed from a site that does not list one? You may be
              able to create one by entering the site URL into a free RSS feed
              generator such as rss.app, then paste the generated feed URL here.
            </p>

            <div className="feed-draft-grid">
              <label>
                Feed Name
                <input
                  value={feedDraft.name}
                  onChange={(event) => updateFeedDraft("name", event.target.value)}
                  placeholder="Local News"
                />
              </label>

              <label>
                Feed URL
                <input
                  value={feedDraft.url}
                  onChange={(event) => updateFeedDraft("url", event.target.value)}
                  placeholder="https://example.com/feed"
                />
              </label>

              <label>
                Category
                <input
                  value={feedDraft.category}
                  onChange={(event) =>
                    updateFeedDraft("category", event.target.value)
                  }
                  placeholder="News"
                />
              </label>

              <label>
                Story Limit
                <input
                  value={feedDraft.storyLimit}
                  onChange={(event) =>
                    updateFeedDraft("storyLimit", event.target.value)
                  }
                  placeholder="8"
                />
              </label>
            </div>

            <button type="button" onClick={addFeed}>
              Add Feed
            </button>

            <div className="feed-manager-list">
              {activeFeeds.map((feed) => (
                <div className="feed-manager-row" key={feed.id}>
                  <div>
                    <strong>{feed.name}</strong>
                    <span>{feed.url}</span>
                    <small>
                      {feed.category} • {feed.storyLimit} stories
                    </small>
                  </div>

                  <div className="feed-manager-actions">
                    <button type="button" onClick={() => toggleFeed(feed.id)}>
                      {feed.active ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => deleteFeed(feed.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
