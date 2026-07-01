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
  storyLimit: number;
  active: boolean;
};

type RssStory = {
  id: string;
  feedId: string;
  feedName: string;
  title: string;
  link: string;
  summary: string;
  category: string;
  published: string;
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
  | "date"
  | "weather"
  | "traffic"
  | "funDays"
  | "birthdays";

type TemplateHeaderDetails = {
  blocks: HeaderBlockKind[];
};

type ShowTemplate = {
  id: string;
  name: string;
  headerDetails: TemplateHeaderDetails;
  breaks: BreakBlock[];
  createdAt: string;
  updatedAt: string;
};

type ShowProfile = {
  id: string;
  name: string;
  settings: ShowSettings;
  templates: ShowTemplate[];
  feeds: Feed[];
  trafficAreas: TrafficArea[];
  weatherLocations: WeatherLocation[];
  communityCalendar: CommunityCalendarItem[];
  createdAt: string;
  updatedAt: string;
};

type FeedDraft = {
  name: string;
  url: string;
  category: string;
  storyLimit: string;
};

type InterviewDraft = {
  guestName: string;
  guestTitle: string;
  organization: string;
  topic: string;
  reason: string;
  bio: string;
  contact: string;
  audience: string;
  segmentLength: string;
  tone: string;
  mustAsk: string;
  avoid: string;
};

type Screen = "dashboard" | "template" | "daily" | "interview";

const SHOWS_STORAGE_KEY = "prepdeck.shows.v3";
const OLD_SHOWS_STORAGE_KEY = "prepdeck.shows.v2";
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

const DEFAULT_HEADER_BLOCKS: HeaderBlockKind[] = ["date"];

const HEADER_OPTIONS: { value: HeaderBlockKind; label: string; description: string }[] = [
  {
    value: "date",
    label: "Today Info",
    description: "Date, time, day of year, and days until Christmas.",
  },
  {
    value: "weather",
    label: "Weather",
    description: "Generated weather read from the saved weather location.",
  },
  {
    value: "traffic",
    label: "Traffic",
    description: "Generated traffic read from TomTom traffic points.",
  },
  {
    value: "funDays",
    label: "National Days",
    description: "A few today-style observances and national days.",
  },
  {
    value: "birthdays",
    label: "Celebrity Birthdays",
    description: "A few notable celebrity birthdays for today.",
  },
];

const DEFAULT_FEEDS: Feed[] = [
  {
    id: "default-news",
    name: "NPR News",
    url: "https://feeds.npr.org/1001/rss.xml",
    category: "News",
    storyLimit: 8,
    active: true,
  },
  {
    id: "default-world",
    name: "BBC World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    category: "News",
    storyLimit: 8,
    active: true,
  },
  {
    id: "default-country",
    name: "Taste of Country",
    url: "https://tasteofcountry.com/feed/",
    category: "Entertainment",
    storyLimit: 8,
    active: true,
  },
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

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneBreaks(source: BreakBlock[]) {
  return source.map((block) => ({
    ...block,
    id: makeId(),
    items: block.items.map((item) => ({
      ...item,
      id: makeId(),
    })),
  }));
}

function cleanText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getDayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

function getDaysUntilChristmas(date: Date) {
  let christmas = new Date(date.getFullYear(), 11, 25);
  if (date > christmas) {
    christmas = new Date(date.getFullYear() + 1, 11, 25);
  }
  return Math.ceil((christmas.getTime() - date.getTime()) / 86400000);
}

function monthDayKey(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function normalizeShow(raw: Partial<ShowProfile>): ShowProfile {
  const nowIso = new Date().toISOString();
  const settings = {
    ...blankSettings,
    ...(raw.settings ?? {}),
  };

  const templates = Array.isArray(raw.templates)
    ? raw.templates.map((template) => ({
        id: template.id ?? makeId(),
        name: template.name ?? "Standard Template",
        headerDetails: {
          blocks:
            template.headerDetails?.blocks?.filter(Boolean).slice(0, 3) ??
            DEFAULT_HEADER_BLOCKS,
        },
        breaks: Array.isArray(template.breaks)
          ? template.breaks.map((block) => ({
              id: block.id ?? makeId(),
              time: block.time ?? "",
              title: block.title ?? "Break",
              items: Array.isArray(block.items)
                ? block.items.map((item) => ({
                    id: item.id ?? makeId(),
                    type: item.type ?? "Note",
                    title: item.title ?? "Item",
                    body: item.body ?? "",
                    url: item.url,
                  }))
                : [],
            }))
          : [],
        createdAt: template.createdAt ?? nowIso,
        updatedAt: template.updatedAt ?? nowIso,
      }))
    : [];

  if (templates.length === 0) {
    templates.push({
      id: makeId(),
      name: "Standard Template",
      headerDetails: { blocks: DEFAULT_HEADER_BLOCKS },
      breaks: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  return {
    id: raw.id ?? makeId(),
    name: raw.name ?? settings.showName ?? "Untitled Show",
    settings,
    templates,
    feeds: Array.isArray(raw.feeds) ? raw.feeds : DEFAULT_FEEDS,
    trafficAreas: Array.isArray(raw.trafficAreas) ? raw.trafficAreas : [],
    weatherLocations: Array.isArray(raw.weatherLocations)
      ? raw.weatherLocations
      : [],
    communityCalendar: Array.isArray(raw.communityCalendar)
      ? raw.communityCalendar
      : [],
    createdAt: raw.createdAt ?? nowIso,
    updatedAt: raw.updatedAt ?? nowIso,
  };
}

function loadShows() {
  try {
    const raw =
      localStorage.getItem(SHOWS_STORAGE_KEY) ??
      localStorage.getItem(OLD_SHOWS_STORAGE_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((show) => normalizeShow(show));
  } catch {
    return [];
  }
}

export default function App() {
  const [shows, setShows] = useState<ShowProfile[]>(loadShows);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [now, setNow] = useState(() => new Date());

  const [activeShowId, setActiveShowId] = useState("");
  const [activeTemplateId, setActiveTemplateId] = useState("");

  const [showCreatorOpen, setShowCreatorOpen] = useState(false);
  const [showDraft, setShowDraft] = useState<ShowSettings>({
    ...blankSettings,
    showName: "",
  });
  const [initialTemplateName, setInitialTemplateName] = useState("Monday Template");

  const [templateNameDraft, setTemplateNameDraft] = useState("");
  const [templateHeader, setTemplateHeader] = useState<TemplateHeaderDetails>({
    blocks: DEFAULT_HEADER_BLOCKS,
  });
  const [breaks, setBreaks] = useState<BreakBlock[]>([]);
  const [breakDraft, setBreakDraft] = useState({ time: "", title: "" });
  const [breakCreatorOpen, setBreakCreatorOpen] = useState(false);

  const [noteCreatorBreakId, setNoteCreatorBreakId] = useState("");
  const [noteDraft, setNoteDraft] = useState({ title: "Host Note", body: "" });

  const [activeSourceTab, setActiveSourceTab] = useState<
    "rss" | "traffic" | "weather" | "calendar" | "header"
  >("rss");

  const [feedDraft, setFeedDraft] = useState<FeedDraft>({
    name: "",
    url: "",
    category: "News",
    storyLimit: "8",
  });
  const [storyBank, setStoryBank] = useState<RssStory[]>([]);
  const [feedStatus, setFeedStatus] = useState("");
  const [isRefreshingRss, setIsRefreshingRss] = useState(false);

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
  const [isRefreshingTraffic, setIsRefreshingTraffic] = useState(false);

  const [weatherDraft, setWeatherDraft] = useState({
    label: "",
    location: "",
  });
  const [weatherStatus, setWeatherStatus] = useState("");
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);

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

  const [dailyBreaks, setDailyBreaks] = useState<BreakBlock[]>([]);
  const [dailySelectedBreakId, setDailySelectedBreakId] = useState("");
  const [activeDailyTab, setActiveDailyTab] = useState<
    "rss" | "weather" | "traffic" | "calendar" | "ai"
  >("rss");
  const [activeRssFilter, setActiveRssFilter] = useState("all");
  const [dailyStationPriority, setDailyStationPriority] = useState("");
  const [dailyContestReminder, setDailyContestReminder] = useState("");
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
  const [previewOpen, setPreviewOpen] = useState(false);

  const [aiTool, setAiTool] = useState("Topic Starter");
  const [aiTopic, setAiTopic] = useState("");
  const [aiOutput, setAiOutput] = useState("");

  const [interviewDraft, setInterviewDraft] = useState<InterviewDraft>({
    guestName: "",
    guestTitle: "",
    organization: "",
    topic: "",
    reason: "",
    bio: "",
    contact: "",
    audience: "General radio audience",
    segmentLength: "8 minutes",
    tone: "smart, conversational, prepared",
    mustAsk: "",
    avoid: "",
  });
  const [interviewOutputTitle, setInterviewOutputTitle] = useState("");
  const [interviewOutput, setInterviewOutput] = useState("");
  const [isInterviewGenerating, setIsInterviewGenerating] = useState(false);

  const activeShow = useMemo(
    () => shows.find((show) => show.id === activeShowId) ?? null,
    [shows, activeShowId]
  );

  const activeTemplate = useMemo(
    () =>
      activeShow?.templates.find((template) => template.id === activeTemplateId) ??
      null,
    [activeShow, activeTemplateId]
  );

  const activeFeeds = activeShow?.feeds ?? [];
  const activeTrafficAreas = activeShow?.trafficAreas ?? [];
  const activeWeatherLocations = activeShow?.weatherLocations ?? [];
  const activeCommunityItems = activeShow?.communityCalendar ?? [];

  const feedCategories = Array.from(
    new Set(activeFeeds.map((feed) => feed.category || "General"))
  );

  const visibleRssStories =
    activeRssFilter === "all"
      ? storyBank
      : activeRssFilter.startsWith("feed:")
      ? storyBank.filter((story) => {
          const feedId = activeRssFilter.replace("feed:", "");
          const feed = activeFeeds.find((item) => item.id === feedId);

          return (
            story.feedId === feedId ||
            story.feedName === feed?.name ||
            story.category === feed?.category ||
            story.category === feed?.name
          );
        })
      : storyBank.filter(
          (story) => story.category === activeRssFilter.replace("cat:", "")
        );

  useEffect(() => {
    localStorage.setItem(SHOWS_STORAGE_KEY, JSON.stringify(shows));
  }, [shows]);

  useEffect(() => {
    localStorage.setItem(TOMTOM_API_KEY_STORAGE_KEY, tomTomApiKey);
  }, [tomTomApiKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  function updateActiveShow(updater: (show: ShowProfile) => ShowProfile) {
    if (!activeShow) return;

    setShows((current) =>
      current.map((show) => (show.id === activeShow.id ? updater(show) : show))
    );
  }

  function createShow() {
    const showName = showDraft.showName.trim();

    if (!showName) {
      window.alert("Show name is required.");
      return;
    }

    const nowIso = new Date().toISOString();
    const templateName = initialTemplateName.trim() || "Standard Template";

    const template: ShowTemplate = {
      id: makeId(),
      name: templateName,
      headerDetails: { blocks: DEFAULT_HEADER_BLOCKS },
      breaks: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const settings = {
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

    const show: ShowProfile = {
      id: makeId(),
      name: showName,
      settings,
      templates: [template],
      feeds: DEFAULT_FEEDS.map((feed) => ({ ...feed, id: makeId() })),
      trafficAreas: [],
      weatherLocations: [],
      communityCalendar: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setShows((current) => [...current, show]);
    setActiveShowId(show.id);
    setActiveTemplateId(template.id);
    setTemplateHeader(template.headerDetails);
    setBreaks([]);
    setShowCreatorOpen(false);
    setScreen("template");
  }

  function openTemplate(show: ShowProfile, template: ShowTemplate) {
    setActiveShowId(show.id);
    setActiveTemplateId(template.id);
    setTemplateHeader({
      blocks: template.headerDetails?.blocks ?? DEFAULT_HEADER_BLOCKS,
    });
    setBreaks(
      template.breaks.map((block) => ({
        ...block,
        items: block.items.map((item) => ({ ...item })),
      }))
    );
    setScreen("template");
  }

  function startDailyPrep(show: ShowProfile, template: ShowTemplate) {
    setActiveShowId(show.id);
    setActiveTemplateId(template.id);
    setTemplateHeader({
      blocks: template.headerDetails?.blocks ?? DEFAULT_HEADER_BLOCKS,
    });
    setBreaks(template.breaks);
    const cloned = cloneBreaks(template.breaks);
    setDailyBreaks(cloned);
    setDailySelectedBreakId(cloned[0]?.id ?? "");
    setStoryBank([]);
    setFeedStatus("");
    setTrafficStatus("");
    setWeatherStatus("");
    setScreen("daily");
  }

  function startDailyPrepFromCurrentTemplate() {
    if (!activeShow || !activeTemplate) return;

    startDailyPrep(activeShow, {
      ...activeTemplate,
      breaks,
      headerDetails: templateHeader,
    });
  }

  function addTemplate(showId: string) {
    const name = templateNameDraft.trim();

    if (!name) {
      window.alert("Template name is required.");
      return;
    }

    const nowIso = new Date().toISOString();

    setShows((current) =>
      current.map((show) =>
        show.id === showId
          ? {
              ...show,
              templates: [
                ...show.templates,
                {
                  id: makeId(),
                  name,
                  headerDetails: { blocks: DEFAULT_HEADER_BLOCKS },
                  breaks: [],
                  createdAt: nowIso,
                  updatedAt: nowIso,
                },
              ],
              updatedAt: nowIso,
            }
          : show
      )
    );

    setTemplateNameDraft("");
  }

  function deleteTemplate(showId: string, templateId: string) {
    setShows((current) =>
      current.map((show) =>
        show.id === showId
          ? {
              ...show,
              templates: show.templates.filter(
                (template) => template.id !== templateId
              ),
              updatedAt: new Date().toISOString(),
            }
          : show
      )
    );
  }

  function saveSetupToTemplate() {
    if (!activeShow || !activeTemplate) return;

    const nowIso = new Date().toISOString();
    const savedHeader = {
      blocks: templateHeader.blocks.filter(Boolean).slice(0, 3),
    };

    const savedBreaks = breaks.map((block) => ({
      ...block,
      items: block.items.map((item) => ({ ...item })),
    }));

    setTemplateHeader(savedHeader);

    setShows((current) =>
      current.map((show) =>
        show.id === activeShow.id
          ? {
              ...show,
              templates: show.templates.map((template) =>
                template.id === activeTemplate.id
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

  function addBreakBlock() {
    setBreakDraft({
      time: activeShow?.settings.showStart || "6:00 AM",
      title: "Break",
    });
    setBreakCreatorOpen(true);
  }

  function saveBreakBlock() {
    const time = breakDraft.time.trim();
    const title = breakDraft.title.trim() || "Break";

    if (!time) {
      window.alert("Break time is required.");
      return;
    }

    setBreaks((current) => [
      ...current,
      {
        id: makeId(),
        time,
        title,
        items: [],
      },
    ]);

    setBreakCreatorOpen(false);
    setBreakDraft({ time: "", title: "" });
  }

  function updateBreak(blockId: string, key: "time" | "title", value: string) {
    setBreaks((current) =>
      current.map((block) =>
        block.id === blockId ? { ...block, [key]: value } : block
      )
    );
  }

  function removeBreak(blockId: string) {
    setBreaks((current) => current.filter((block) => block.id !== blockId));
  }

  function addNoteToBreak(blockId: string) {
    setNoteCreatorBreakId(blockId);
    setNoteDraft({ title: "Host Note", body: "" });
  }

  function saveNoteToBreak(blockId: string) {
    const title = noteDraft.title.trim() || "Host Note";
    const body = noteDraft.body.trim();

    setBreaks((current) =>
      current.map((block) =>
        block.id === blockId
          ? {
              ...block,
              items: [...block.items, { id: makeId(), type: "Note", title, body }],
            }
          : block
      )
    );

    setNoteCreatorBreakId("");
    setNoteDraft({ title: "Host Note", body: "" });
  }

  function removeTemplateItem(blockId: string, itemId: string) {
    setBreaks((current) =>
      current.map((block) =>
        block.id === blockId
          ? { ...block, items: block.items.filter((item) => item.id !== itemId) }
          : block
      )
    );
  }

  function addHeaderBlock(block: HeaderBlockKind) {
    setTemplateHeader((current) => {
      const currentBlocks = current.blocks.filter(Boolean).slice(0, 3);

      if (currentBlocks.includes(block)) return current;
      if (currentBlocks.length >= 3) {
        window.alert("You can add up to three header blocks.");
        return current;
      }

      return { blocks: [...currentBlocks, block] };
    });
  }

  function removeHeaderBlock(index: number) {
    setTemplateHeader((current) => ({
      blocks: current.blocks.filter((_, blockIndex) => blockIndex !== index),
    }));
  }

  function getHeaderBlockData(block: HeaderBlockKind) {
    const key = monthDayKey(now);

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
      const weather = activeWeatherLocations.find((location) => location.active);
      return {
        title: "Weather",
        lines: [
          weather?.lastRead ??
            "Refresh weather to generate the current weather read.",
        ],
      };
    }

    if (block === "traffic") {
      const traffic = activeTrafficAreas.find((area) => area.active);
      return {
        title: "Traffic",
        lines: [
          traffic?.lastRead ??
            "Refresh traffic to generate the current traffic read.",
        ],
      };
    }

    if (block === "funDays") {
      return {
        title: "National Days",
        lines: FUN_DAY_LOOKUP[key] ?? ["No built-in national days for today yet."],
      };
    }

    return {
      title: "Birthdays",
      lines: BIRTHDAY_LOOKUP[key] ?? ["No built-in birthdays for today yet."],
    };
  }

  function renderHeaderBlocks() {
    const blocks = templateHeader.blocks.filter(Boolean).slice(0, 3);

    if (blocks.length === 0) return null;

    return (
      <div className="header-block-stack">
        {blocks.map((block, index) => {
          const data = getHeaderBlockData(block);

          return (
            <div className="header-info-block" key={`${block}-${index}`}>
              <strong>{data.title}</strong>
              <div>
                {data.lines.map((line, lineIndex) => (
                  <span key={`${block}-${lineIndex}`}>{line}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function parseRssStories(xml: string, feed: Feed) {
    const parser = new DOMParser();
    const document = parser.parseFromString(xml, "text/xml");

    if (document.querySelector("parsererror")) return [];

    const rssItems = Array.from(document.querySelectorAll("item"));
    const atomItems = Array.from(document.querySelectorAll("entry"));
    const items = rssItems.length ? rssItems : atomItems;
    const limit = Number(feed.storyLimit) || 10;

    return items.slice(0, limit).map((item, index): RssStory => {
      const title =
        item.querySelector("title")?.textContent?.trim() || "Untitled story";

      const rssLink = item.querySelector("link")?.textContent?.trim() || "";
      const atomLink =
        item.querySelector("link")?.getAttribute("href")?.trim() || "";

      const summary =
        item.querySelector("description")?.textContent?.trim() ||
        item.querySelector("summary")?.textContent?.trim() ||
        item.querySelector("content")?.textContent?.trim() ||
        "";

      const published =
        item.querySelector("pubDate")?.textContent?.trim() ||
        item.querySelector("published")?.textContent?.trim() ||
        item.querySelector("updated")?.textContent?.trim() ||
        "";

      return {
        id: `${feed.id}-${Date.now()}-${index}`,
        feedId: feed.id,
        feedName: feed.name,
        title: cleanText(title),
        link: rssLink || atomLink,
        summary: cleanText(summary),
        category: feed.category || feed.name,
        published,
      };
    });
  }

  async function refreshRssFeeds() {
    if (!activeShow) return;

    const active = activeFeeds.filter((feed) => feed.active);

    if (active.length === 0) {
      setFeedStatus("No active RSS feeds.");
      return;
    }

    setIsRefreshingRss(true);
    setFeedStatus("Refreshing RSS...");

    const stories: RssStory[] = [];
    const failures: string[] = [];

    for (const feed of active) {
      try {
        const xml = await invoke<string>("fetch_url", { url: feed.url });
        stories.push(...parseRssStories(xml, feed));
      } catch {
        failures.push(feed.name);
      }
    }

    setStoryBank(stories);
    setActiveRssFilter("all");
    setIsRefreshingRss(false);

    if (failures.length) {
      setFeedStatus(
        `Loaded ${stories.length} stories. Could not refresh: ${failures.join(
          ", "
        )}.`
      );
    } else {
      setFeedStatus(`Loaded ${stories.length} stories.`);
    }
  }

  function addFeed() {
    if (!activeShow) return;

    const name = feedDraft.name.trim();
    const url = feedDraft.url.trim();

    if (!name || !url) {
      window.alert("Feed name and URL are required.");
      return;
    }

    updateActiveShow((show) => ({
      ...show,
      feeds: [
        ...show.feeds,
        {
          id: makeId(),
          name,
          url,
          category: feedDraft.category.trim() || "General",
          storyLimit: Number(feedDraft.storyLimit) || 8,
          active: true,
        },
      ],
      updatedAt: new Date().toISOString(),
    }));

    setFeedDraft({ name: "", url: "", category: "News", storyLimit: "8" });
  }

  function toggleFeed(feedId: string) {
    updateActiveShow((show) => ({
      ...show,
      feeds: show.feeds.map((feed) =>
        feed.id === feedId ? { ...feed, active: !feed.active } : feed
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function deleteFeed(feedId: string) {
    updateActiveShow((show) => ({
      ...show,
      feeds: show.feeds.filter((feed) => feed.id !== feedId),
      updatedAt: new Date().toISOString(),
    }));
  }

  async function resolveWeatherCoordinates(location: WeatherLocation) {
    const raw = location.location.trim();
    const latLon = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);

    if (latLon) {
      return { latitude: latLon[1], longitude: latLon[2] };
    }

    let lookupUrl = "";

    if (/^\d{5}$/.test(raw)) {
      lookupUrl = `https://api.zippopotam.us/us/${encodeURIComponent(raw)}`;
    } else {
      const cityState = raw.match(/^(.+),\s*([A-Za-z]{2})$/);
      if (cityState) {
        lookupUrl = `https://api.zippopotam.us/us/${cityState[2].toLowerCase()}/${encodeURIComponent(
          cityState[1].trim()
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
      throw new Error("Could not find coordinates.");
    }

    return {
      latitude: String(place.latitude),
      longitude: String(place.longitude),
    };
  }

  async function refreshWeatherLocation(location: WeatherLocation) {
    const coordinates = await resolveWeatherCoordinates(location);
    const pointsUrl = `https://api.weather.gov/points/${coordinates.latitude},${coordinates.longitude}`;
    const pointsResponse = await invoke<string>("fetch_url", { url: pointsUrl });
    const pointsData = JSON.parse(pointsResponse);
    const forecastUrl = pointsData?.properties?.forecast;

    if (!forecastUrl) throw new Error("No forecast URL returned.");

    const forecastResponse = await invoke<string>("fetch_url", {
      url: forecastUrl,
    });
    const forecastData = JSON.parse(forecastResponse);
    const period = forecastData?.properties?.periods?.[0];

    if (!period) {
      return `${location.label}: Weather data came back, but no forecast was available.`;
    }

    return `${location.label}: ${period.name ? `${period.name}: ` : ""}${
      period.shortForecast || ""
    }, around ${period.temperature ?? ""} degrees ${
      period.temperatureUnit ?? ""
    }. Winds ${period.windDirection ?? ""} ${period.windSpeed ?? ""}. ${
      period.detailedForecast ?? ""
    }`
      .replace(/\s+/g, " ")
      .trim();
  }

  async function refreshWeather() {
    if (!activeShow) return;

    const locations = activeWeatherLocations.filter((location) => location.active);

    if (locations.length === 0) {
      setWeatherStatus("No active weather locations.");
      return;
    }

    setIsRefreshingWeather(true);
    setWeatherStatus("Refreshing weather...");

    const updated: Record<string, string> = {};
    const failures: string[] = [];

    for (const location of locations) {
      try {
        updated[location.id] = await refreshWeatherLocation(location);
      } catch {
        failures.push(location.label);
      }
    }

    const nowIso = new Date().toISOString();

    updateActiveShow((show) => ({
      ...show,
      weatherLocations: show.weatherLocations.map((location) =>
        updated[location.id]
          ? { ...location, lastRead: updated[location.id], lastUpdated: nowIso }
          : location
      ),
      updatedAt: nowIso,
    }));

    setIsRefreshingWeather(false);
    setWeatherStatus(
      failures.length
        ? `Weather refreshed with failures: ${failures.join(", ")}.`
        : "Weather refreshed."
    );
  }

  function addWeatherLocation() {
    const label = weatherDraft.label.trim();
    const location = weatherDraft.location.trim();

    if (!label || !location) {
      window.alert("Weather label and location are required.");
      return;
    }

    updateActiveShow((show) => ({
      ...show,
      weatherLocations: [
        ...show.weatherLocations,
        { id: makeId(), label, location, active: true },
      ],
      updatedAt: new Date().toISOString(),
    }));

    setWeatherDraft({ label: "", location: "" });
  }

  function toggleWeatherLocation(id: string) {
    updateActiveShow((show) => ({
      ...show,
      weatherLocations: show.weatherLocations.map((location) =>
        location.id === id ? { ...location, active: !location.active } : location
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function deleteWeatherLocation(id: string) {
    updateActiveShow((show) => ({
      ...show,
      weatherLocations: show.weatherLocations.filter(
        (location) => location.id !== id
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  async function refreshTrafficArea(area: TrafficArea) {
    if (!tomTomApiKey.trim()) throw new Error("TomTom API key required.");

    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${encodeURIComponent(
      `${area.latitude},${area.longitude}`
    )}&unit=mph&key=${encodeURIComponent(tomTomApiKey.trim())}`;

    const response = await invoke<string>("fetch_url", { url });
    const data = JSON.parse(response);
    const segment = data?.flowSegmentData ?? data;

    const currentSpeed = Number(segment?.currentSpeed ?? 0);
    const freeFlowSpeed = Number(segment?.freeFlowSpeed ?? 0);
    const currentTravelTime = Number(segment?.currentTravelTime ?? 0);
    const freeFlowTravelTime = Number(segment?.freeFlowTravelTime ?? 0);
    const roadClosure = Boolean(segment?.roadClosure);

    if (roadClosure) {
      return `${area.label}: A road closure is showing near this traffic point.`;
    }

    if (!currentSpeed || !freeFlowSpeed) {
      return `${area.label}: Traffic data returned, but not enough speed information was available.`;
    }

    const ratio = currentSpeed / freeFlowSpeed;
    const delayMinutes = Math.max(
      0,
      Math.round((currentTravelTime - freeFlowTravelTime) / 60)
    );

    let condition = "moving normally";
    if (ratio < 0.45) condition = "very heavy";
    else if (ratio < 0.7) condition = "slower than normal";
    else if (ratio < 0.9) condition = "a little slow";

    return `${area.label}: Traffic is ${condition}. Current speed is about ${Math.round(
      currentSpeed
    )} miles per hour.${
      delayMinutes > 0
        ? ` That is adding about ${delayMinutes} minute${
            delayMinutes === 1 ? "" : "s"
          } of delay.`
        : " No major delay is showing right now."
    }`;
  }

  async function refreshTraffic() {
    if (!activeShow) return;

    const areas = activeTrafficAreas.filter((area) => area.active);

    if (!tomTomApiKey.trim()) {
      setTrafficStatus("Enter a TomTom API key first.");
      return;
    }

    if (areas.length === 0) {
      setTrafficStatus("No active traffic areas.");
      return;
    }

    setIsRefreshingTraffic(true);
    setTrafficStatus("Refreshing traffic...");

    const updated: Record<string, string> = {};
    const failures: string[] = [];

    for (const area of areas) {
      try {
        updated[area.id] = await refreshTrafficArea(area);
      } catch {
        failures.push(area.label);
      }
    }

    const nowIso = new Date().toISOString();

    updateActiveShow((show) => ({
      ...show,
      trafficAreas: show.trafficAreas.map((area) =>
        updated[area.id]
          ? { ...area, lastRead: updated[area.id], lastUpdated: nowIso }
          : area
      ),
      updatedAt: nowIso,
    }));

    setIsRefreshingTraffic(false);
    setTrafficStatus(
      failures.length
        ? `Traffic refreshed with failures: ${failures.join(", ")}.`
        : "Traffic refreshed."
    );
  }

  function addTrafficArea() {
    const label = trafficDraft.label.trim();
    const latitude = trafficDraft.latitude.trim();
    const longitude = trafficDraft.longitude.trim();

    if (!label || !latitude || !longitude) {
      window.alert("Traffic label, latitude, and longitude are required.");
      return;
    }

    updateActiveShow((show) => ({
      ...show,
      trafficAreas: [
        ...show.trafficAreas,
        {
          id: makeId(),
          label,
          latitude,
          longitude,
          description: trafficDraft.description.trim(),
          active: true,
        },
      ],
      updatedAt: new Date().toISOString(),
    }));

    setTrafficDraft({ label: "", latitude: "", longitude: "", description: "" });
  }

  function toggleTrafficArea(id: string) {
    updateActiveShow((show) => ({
      ...show,
      trafficAreas: show.trafficAreas.map((area) =>
        area.id === id ? { ...area, active: !area.active } : area
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function deleteTrafficArea(id: string) {
    updateActiveShow((show) => ({
      ...show,
      trafficAreas: show.trafficAreas.filter((area) => area.id !== id),
      updatedAt: new Date().toISOString(),
    }));
  }

  function addCommunityItem() {
    const title = communityDraft.title.trim();
    const date = communityDraft.date.trim();

    if (!title || !date) {
      window.alert("Title and date are required.");
      return;
    }

    updateActiveShow((show) => ({
      ...show,
      communityCalendar: [
        ...show.communityCalendar,
        {
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
        },
      ].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
      updatedAt: new Date().toISOString(),
    }));

    setCommunityDraft({
      title: "",
      date: "",
      time: "",
      location: "",
      category: "Community",
      details: "",
      url: "",
    });
  }

  function toggleCommunityItem(id: string) {
    updateActiveShow((show) => ({
      ...show,
      communityCalendar: show.communityCalendar.map((item) =>
        item.id === id ? { ...item, active: !item.active } : item
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function deleteCommunityItem(id: string) {
    updateActiveShow((show) => ({
      ...show,
      communityCalendar: show.communityCalendar.filter((item) => item.id !== id),
      updatedAt: new Date().toISOString(),
    }));
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
    const datePart = clean.slice(0, 8);

    if (!/^\d{8}$/.test(datePart)) return { date: "", time: "" };

    const date = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(
      6,
      8
    )}`;

    if (!clean.includes("T")) return { date, time: "" };

    const hour = Number(clean.slice(9, 11));
    const minute = clean.slice(11, 13) || "00";
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return { date, time: `${displayHour}:${minute} ${suffix}` };
  }

  function handleIcsImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      const lines: string[] = [];

      for (const line of content.split(/\r?\n/)) {
        if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length) {
          lines[lines.length - 1] += line.slice(1);
        } else {
          lines.push(line);
        }
      }

      const items: CommunityCalendarItem[] = [];
      let insideEvent = false;
      let eventLines: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed === "BEGIN:VEVENT") {
          insideEvent = true;
          eventLines = [];
          continue;
        }

        if (trimmed === "END:VEVENT") {
          const fields: Record<string, string> = {};

          for (const eventLine of eventLines) {
            const separator = eventLine.indexOf(":");
            if (separator === -1) continue;

            const key = eventLine.slice(0, separator).split(";")[0].toUpperCase();
            const value = cleanIcsValue(eventLine.slice(separator + 1));

            if (!fields[key]) fields[key] = value;
          }

          const start = formatIcsDateTime(fields.DTSTART ?? "");

          if (start.date) {
            items.push({
              id: makeId(),
              title: fields.SUMMARY || "Untitled Event",
              date: start.date,
              time: start.time,
              location: fields.LOCATION ?? "",
              category: fields.CATEGORIES ?? "Community",
              details: fields.DESCRIPTION ?? "",
              url: fields.URL ?? "",
              active: true,
              source: "ics",
              importedFrom: file.name,
            });
          }

          insideEvent = false;
          eventLines = [];
          continue;
        }

        if (insideEvent) eventLines.push(line);
      }

      if (items.length === 0) {
        setCommunityStatus("No usable events found in that .ICS file.");
        return;
      }

      updateActiveShow((show) => ({
        ...show,
        communityCalendar: [...show.communityCalendar, ...items].sort((a, b) =>
          `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
        ),
        updatedAt: new Date().toISOString(),
      }));

      setCommunityStatus(
        `Imported ${items.length} event${items.length === 1 ? "" : "s"}.`
      );
    };

    reader.readAsText(file);
    event.target.value = "";
  }

  async function refreshAllSources() {
    await refreshRssFeeds();
    await refreshWeather();
    await refreshTraffic();
  }

  function addPrepItemToDailyBreak(item: PrepItem) {
    if (!dailySelectedBreakId) {
      window.alert("Choose a break first.");
      return;
    }

    setDailyBreaks((current) =>
      current.map((block) =>
        block.id === dailySelectedBreakId
          ? { ...block, items: [...block.items, item] }
          : block
      )
    );
  }

  function addRssStoryToBreak(story: RssStory) {
    addPrepItemToDailyBreak({
      id: makeId(),
      type: story.category || "RSS",
      title: story.title,
      body: story.summary || story.feedName,
      url: story.link,
    });
  }

  function addWeatherToBreak(location: WeatherLocation) {
    addPrepItemToDailyBreak({
      id: makeId(),
      type: "Weather",
      title: location.label,
      body:
        location.lastRead ||
        `Refresh weather first for ${location.location}, then add the generated read.`,
    });
  }

  function addTrafficToBreak(area: TrafficArea) {
    addPrepItemToDailyBreak({
      id: makeId(),
      type: "Traffic",
      title: area.label,
      body: area.lastRead || "Refresh traffic first, then add the generated read.",
    });
  }

  function addCommunityToBreak(item: CommunityCalendarItem) {
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

  function openDailyNoteForm(blockId: string) {
    setDailyNoteCreatorBreakId(blockId);
    setDailyNoteDraft({ title: "Host Note", body: "" });
  }

  function saveDailyNoteToBreak(blockId: string) {
    setDailyBreaks((current) =>
      current.map((block) =>
        block.id === blockId
          ? {
              ...block,
              items: [
                ...block.items,
                {
                  id: makeId(),
                  type: "Note",
                  title: dailyNoteDraft.title.trim() || "Host Note",
                  body: dailyNoteDraft.body.trim(),
                },
              ],
            }
          : block
      )
    );

    setDailyNoteCreatorBreakId("");
    setDailyNoteDraft({ title: "Host Note", body: "" });
  }

  function openDailyBreakOptionForm(blockId: string, type: string) {
    setDailyBreakOptionDraft({ blockId, type, title: type, body: "" });
  }

  function saveDailyBreakOptionToBreak() {
    const blockId = dailyBreakOptionDraft.blockId;
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
                  type: dailyBreakOptionDraft.type || "Break Item",
                  title:
                    dailyBreakOptionDraft.title.trim() ||
                    dailyBreakOptionDraft.type ||
                    "Break Item",
                  body: dailyBreakOptionDraft.body.trim(),
                },
              ],
            }
          : block
      )
    );

    setDailyBreakOptionDraft({ blockId: "", type: "", title: "", body: "" });
  }

  function removeDailyItem(blockId: string, itemId: string) {
    setDailyBreaks((current) =>
      current.map((block) =>
        block.id === blockId
          ? { ...block, items: block.items.filter((item) => item.id !== itemId) }
          : block
      )
    );
  }

  function generateAiContent() {
    const topic = aiTopic.trim() || "today’s show";

    let output = "";

    if (aiTool === "Interview Questions") {
      output = `Interview prep for ${topic}:\n1. What made this story worth telling now?\n2. What would listeners misunderstand about this?\n3. What is the most practical takeaway?\n4. What should people do next?`;
    } else if (aiTool === "Promo Script") {
      output = `Promo: Coming up on the show, we are talking about ${topic}. Stay with us for the story, the angle that matters, and what it means for our listeners.`;
    } else if (aiTool === "Contest Idea") {
      output = `Contest idea for ${topic}: Build a simple caller-based giveaway with a clear cue, a sponsor mention, and one easy question tied to the day’s topic.`;
    } else if (aiTool === "Social Post") {
      output = `Social post: We’re talking about ${topic} today. What’s your take? Listen live and join the conversation.`;
    } else {
      output = `Topic starter for ${topic}: What makes this matter to our listeners today, and what is the cleanest way to turn it into a local, relatable break?`;
    }

    setAiOutput(output);
  }

  function addAiOutputToBreak() {
    if (!aiOutput.trim()) return;

    addPrepItemToDailyBreak({
      id: makeId(),
      type: aiTool,
      title: aiTopic.trim() || aiTool,
      body: aiOutput.trim(),
    });
  }


  function updateInterviewDraft(key: keyof InterviewDraft, value: string) {
    setInterviewDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function buildInterviewPrompt(asset: string) {
    return `You are a professional radio show producer preparing an interview.

Create: ${asset}

Guest Name: ${interviewDraft.guestName || "Not provided"}
Guest Title / Role: ${interviewDraft.guestTitle || "Not provided"}
Organization: ${interviewDraft.organization || "Not provided"}
Interview Topic: ${interviewDraft.topic || "Not provided"}
Why this interview matters now: ${interviewDraft.reason || "Not provided"}
Guest Background: ${interviewDraft.bio || "Not provided"}
Contact / known notes: ${interviewDraft.contact || "Not provided"}
Audience: ${interviewDraft.audience || "General radio audience"}
Segment Length: ${interviewDraft.segmentLength || "Not provided"}
Tone: ${interviewDraft.tone || "smart, conversational, prepared"}
Must ask: ${interviewDraft.mustAsk || "None provided"}
Avoid: ${interviewDraft.avoid || "None provided"}

Format the output for a live radio host. Keep it clean, practical, and ready to use.`;
  }

  function fallbackInterviewContent(asset: string) {
    const guest = interviewDraft.guestName || "the guest";
    const topic = interviewDraft.topic || "the topic";

    if (asset === "Interview Questions") {
      return `Interview Questions for ${guest}

1. Start by giving listeners the quick version of who you are and why ${topic} matters.
2. What is the part of this story people usually misunderstand?
3. What made this worth talking about right now?
4. What is the most important thing our listeners should know before they form an opinion?
5. Where do people tend to oversimplify this?
6. What changed recently that makes this more urgent?
7. What is one practical takeaway listeners can use today?
8. What should people watch for next?`;
    }

    if (asset === "Follow-Up Questions") {
      return `Follow-Up Questions for ${guest}

1. When you say that, what do you mean specifically?
2. Can you give me an example?
3. What would you say to the listener who disagrees with that?
4. How did you first realize this was an issue?
5. What is the consequence if people ignore this?
6. Is there anything in this story that surprised even you?
7. What is the next step from here?`;
    }

    if (asset === "Guest Intro") {
      return `Guest Introduction

Joining us now is ${guest}${interviewDraft.guestTitle ? `, ${interviewDraft.guestTitle}` : ""}${interviewDraft.organization ? ` with ${interviewDraft.organization}` : ""}. We’re talking about ${topic}, why it matters right now, and what listeners need to understand before they move on with their day.`;
    }

    if (asset === "Segment Tease") {
      return `Segment Tease

Coming up, we’re talking with ${guest} about ${topic}. What sounds simple on the surface may be a lot more important than people realize. Stay with us.`;
    }

    return `If Time Allows Questions

1. What did we not get to that we should have?
2. What is one question you wish more people would ask about this?
3. What should listeners read, watch, or do next?
4. What has changed your own thinking on this?
5. Where can people find out more?`;
  }

  async function generateInterviewAsset(asset: string) {
    setIsInterviewGenerating(true);
    setInterviewOutputTitle(asset);

    try {
      const response = await invoke<string>("ollama_generate", {
        prompt: buildInterviewPrompt(asset),
        model: "llama3.2:3b",
      });

      setInterviewOutput(response.trim() || fallbackInterviewContent(asset));
    } catch {
      setInterviewOutput(fallbackInterviewContent(asset));
    } finally {
      setIsInterviewGenerating(false);
    }
  }

  function addInterviewOutputToBreak() {
    if (!interviewOutput.trim()) return;

    addPrepItemToDailyBreak({
      id: makeId(),
      type: "Interview Prep",
      title:
        interviewOutputTitle ||
        interviewDraft.guestName ||
        interviewDraft.topic ||
        "Interview Prep",
      body: interviewOutput.trim(),
    });
  }


  function renderSidebar() {
    return (
      <aside className="left-sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">PD</div>
          <div>
            <strong>PrepDeck</strong>
            <span>Radio prep suite</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            type="button"
            className={screen === "dashboard" ? "active" : ""}
            onClick={() => setScreen("dashboard")}
          >
            <span>Show Prep</span>
            <small>Shows and templates</small>
          </button>

          <button
            type="button"
            className={screen === "template" ? "active" : ""}
            onClick={() => {
              if (activeShow && activeTemplate) {
                setScreen("template");
              } else {
                setScreen("dashboard");
              }
            }}
          >
            <span>Template Builder</span>
            <small>Clock and sources</small>
          </button>

          <button
            type="button"
            className={screen === "daily" ? "active" : ""}
            onClick={() => {
              if (dailyBreaks.length > 0) {
                setScreen("daily");
              } else if (activeShow && activeTemplate) {
                startDailyPrepFromCurrentTemplate();
              } else {
                setScreen("dashboard");
              }
            }}
          >
            <span>Daily Prep</span>
            <small>Today’s rundown</small>
          </button>

          <button
            type="button"
            className={screen === "interview" ? "active" : ""}
            onClick={() => setScreen("interview")}
          >
            <span>Interview Prep</span>
            <small>Guest questions and teases</small>
          </button>
        </nav>

        <div className="sidebar-footer">
          <strong>{activeShow?.settings.showName || "No show open"}</strong>
          <span>{activeTemplate?.name || "No template selected"}</span>
        </div>
      </aside>
    );
  }

  function renderShowHeader(label: string) {
    return (
      <header className="workspace-header">
        <div className="app-mark">
          <div className="brand-lockup">
            <div className="brand-icon">PD</div>
            <div>
              <strong>PrepDeck</strong>
              <span>Daily show prep</span>
            </div>
          </div>
        </div>

        <div className="show-info">
          <p className="eyebrow">{label}</p>
          <h1>{activeShow?.settings.showName || "PrepDeck"}</h1>
          <p>
            {activeShow?.settings.stationName || "Station not set"}
            {activeShow?.settings.market ? ` • ${activeShow.settings.market}` : ""}
            {activeShow?.settings.showStart
              ? ` • ${activeShow.settings.showStart}–${activeShow.settings.showEnd}`
              : ""}
          </p>
          <p>
            <strong>Text:</strong> {activeShow?.settings.textLine || "Not set"} ·{" "}
            <strong>Phone:</strong> {activeShow?.settings.phoneLine || "Not set"}
          </p>
        </div>

        {renderHeaderBlocks()}
      </header>
    );
  }

  function renderContentFeedsPanel() {
    return (
      <section className="content-feeds-panel">
        <div className="content-feeds-header">
          <div>
            <p className="eyebrow">Show-Level Sources</p>
            <h2>Content Feeds</h2>
          </div>

          <button type="button" onClick={refreshAllSources}>
            Refresh All
          </button>
        </div>

        <div className="source-tabs">
          <button
            type="button"
            className={activeSourceTab === "rss" ? "active" : ""}
            onClick={() => setActiveSourceTab("rss")}
          >
            RSS <span>{activeFeeds.filter((feed) => feed.active).length}</span>
          </button>
          <button
            type="button"
            className={activeSourceTab === "weather" ? "active" : ""}
            onClick={() => setActiveSourceTab("weather")}
          >
            Weather{" "}
            <span>
              {activeWeatherLocations.filter((location) => location.active).length}
            </span>
          </button>
          <button
            type="button"
            className={activeSourceTab === "traffic" ? "active" : ""}
            onClick={() => setActiveSourceTab("traffic")}
          >
            Traffic{" "}
            <span>{activeTrafficAreas.filter((area) => area.active).length}</span>
          </button>
          <button
            type="button"
            className={activeSourceTab === "calendar" ? "active" : ""}
            onClick={() => setActiveSourceTab("calendar")}
          >
            Calendar{" "}
            <span>
              {activeCommunityItems.filter((item) => item.active).length}
            </span>
          </button>
          <button
            type="button"
            className={activeSourceTab === "header" ? "active" : ""}
            onClick={() => setActiveSourceTab("header")}
          >
            Header <span>{templateHeader.blocks.length}</span>
          </button>
        </div>

        {activeSourceTab === "rss" ? (
          <div className="source-tab-panel">
            <div className="input-grid feed-grid">
              <label>
                Feed Name
                <input
                  value={feedDraft.name}
                  onChange={(event) =>
                    setFeedDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Local News"
                />
              </label>
              <label>
                Feed URL
                <input
                  value={feedDraft.url}
                  onChange={(event) =>
                    setFeedDraft((current) => ({
                      ...current,
                      url: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                />
              </label>
              <label>
                Category
                <input
                  value={feedDraft.category}
                  onChange={(event) =>
                    setFeedDraft((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  placeholder="News"
                />
              </label>
              <label>
                Limit
                <input
                  value={feedDraft.storyLimit}
                  onChange={(event) =>
                    setFeedDraft((current) => ({
                      ...current,
                      storyLimit: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="action-row">
              <button type="button" onClick={addFeed}>
                Add Feed
              </button>
              <button
                type="button"
                onClick={refreshRssFeeds}
                disabled={isRefreshingRss}
              >
                {isRefreshingRss ? "Refreshing..." : "Refresh RSS"}
              </button>
            </div>

            {feedStatus ? <p className="status-line">{feedStatus}</p> : null}

            <div className="source-list">
              {activeFeeds.map((feed) => (
                <div className="source-row" key={feed.id}>
                  <div>
                    <strong>{feed.name}</strong>
                    <span>
                      {feed.category} · {feed.url}
                    </span>
                  </div>
                  <div className="row-actions">
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
          </div>
        ) : null}

        {activeSourceTab === "weather" ? (
          <div className="source-tab-panel">
            <div className="input-grid two">
              <label>
                Weather Label
                <input
                  value={weatherDraft.label}
                  onChange={(event) =>
                    setWeatherDraft((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                  placeholder="Home Market"
                />
              </label>
              <label>
                ZIP / City / Coordinates
                <input
                  value={weatherDraft.location}
                  onChange={(event) =>
                    setWeatherDraft((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                  placeholder="38019 or Covington, TN"
                />
              </label>
            </div>

            <div className="action-row">
              <button type="button" onClick={addWeatherLocation}>
                Add Weather Location
              </button>
              <button
                type="button"
                onClick={refreshWeather}
                disabled={isRefreshingWeather}
              >
                {isRefreshingWeather ? "Refreshing..." : "Refresh Weather"}
              </button>
            </div>

            {weatherStatus ? <p className="status-line">{weatherStatus}</p> : null}

            <div className="source-list">
              {activeWeatherLocations.map((location) => (
                <div className="source-row" key={location.id}>
                  <div>
                    <strong>{location.label}</strong>
                    <span>{location.location}</span>
                    {location.lastRead ? <p>{location.lastRead}</p> : null}
                  </div>
                  <div className="row-actions">
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

        {activeSourceTab === "traffic" ? (
          <div className="source-tab-panel">
            <label className="api-field">
              TomTom API Key
              <input
                value={tomTomApiKey}
                onChange={(event) => setTomTomApiKey(event.target.value)}
                placeholder="Paste TomTom API key"
              />
            </label>

            <div className="input-grid traffic-grid">
              <label>
                Area
                <input
                  value={trafficDraft.label}
                  onChange={(event) =>
                    setTrafficDraft((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                  placeholder="Highway 51"
                />
              </label>
              <label>
                Latitude
                <input
                  value={trafficDraft.latitude}
                  onChange={(event) =>
                    setTrafficDraft((current) => ({
                      ...current,
                      latitude: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Longitude
                <input
                  value={trafficDraft.longitude}
                  onChange={(event) =>
                    setTrafficDraft((current) => ({
                      ...current,
                      longitude: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Description
                <input
                  value={trafficDraft.description}
                  onChange={(event) =>
                    setTrafficDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="action-row">
              <button type="button" onClick={addTrafficArea}>
                Add Traffic Area
              </button>
              <button
                type="button"
                onClick={refreshTraffic}
                disabled={isRefreshingTraffic}
              >
                {isRefreshingTraffic ? "Refreshing..." : "Refresh Traffic"}
              </button>
            </div>

            {trafficStatus ? <p className="status-line">{trafficStatus}</p> : null}

            <div className="source-list">
              {activeTrafficAreas.map((area) => (
                <div className="source-row" key={area.id}>
                  <div>
                    <strong>{area.label}</strong>
                    <span>
                      {area.latitude}, {area.longitude}
                    </span>
                    {area.lastRead ? <p>{area.lastRead}</p> : null}
                  </div>
                  <div className="row-actions">
                    <button
                      type="button"
                      onClick={() => toggleTrafficArea(area.id)}
                    >
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

        {activeSourceTab === "calendar" ? (
          <div className="source-tab-panel">
            <div className="source-tab-top">
              <h3>Community Calendar</h3>
              <label className="upload-button">
                Import .ICS
                <input
                  type="file"
                  accept=".ics,text/calendar"
                  onChange={handleIcsImport}
                />
              </label>
            </div>

            <div className="input-grid calendar-grid">
              <label>
                Title
                <input
                  value={communityDraft.title}
                  onChange={(event) =>
                    setCommunityDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={communityDraft.date}
                  onChange={(event) =>
                    setCommunityDraft((current) => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Time
                <input
                  value={communityDraft.time}
                  onChange={(event) =>
                    setCommunityDraft((current) => ({
                      ...current,
                      time: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Category
                <input
                  value={communityDraft.category}
                  onChange={(event) =>
                    setCommunityDraft((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Location
                <input
                  value={communityDraft.location}
                  onChange={(event) =>
                    setCommunityDraft((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                URL
                <input
                  value={communityDraft.url}
                  onChange={(event) =>
                    setCommunityDraft((current) => ({
                      ...current,
                      url: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="wide">
                Details
                <textarea
                  value={communityDraft.details}
                  onChange={(event) =>
                    setCommunityDraft((current) => ({
                      ...current,
                      details: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="action-row">
              <button type="button" onClick={addCommunityItem}>
                Add Calendar Item
              </button>
            </div>

            {communityStatus ? (
              <p className="status-line">{communityStatus}</p>
            ) : null}

            <div className="source-list">
              {activeCommunityItems.map((item) => (
                <div className="source-row" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      {item.date}
                      {item.time ? ` at ${item.time}` : ""}
                      {item.location ? ` · ${item.location}` : ""}
                    </span>
                    {item.details ? <p>{item.details}</p> : null}
                  </div>
                  <div className="row-actions">
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
          </div>
        ) : null}

        {activeSourceTab === "header" ? (
          <div className="source-tab-panel">
            <div className="header-option-list">
              {HEADER_OPTIONS.map((option) => {
                const added = templateHeader.blocks.includes(option.value);
                const limitReached = templateHeader.blocks.length >= 3 && !added;

                return (
                  <div className="header-option-row" key={option.value}>
                    <div>
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </div>
                    <button
                      type="button"
                      disabled={added || limitReached}
                      onClick={() => addHeaderBlock(option.value)}
                    >
                      {added ? "Added" : "Add to Header"}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="selected-header-list">
              {templateHeader.blocks.length === 0 ? (
                <p className="small-muted">No header blocks selected.</p>
              ) : (
                templateHeader.blocks.map((block, index) => {
                  const data = getHeaderBlockData(block);

                  return (
                    <div className="selected-header-row" key={`${block}-${index}`}>
                      <div>
                        <strong>{data.title}</strong>
                        <span>{data.lines.join(" • ")}</span>
                      </div>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => removeHeaderBlock(index)}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </section>
    );
  }


  if (screen === "interview") {
    return (
      <main className="app-shell">
        {renderSidebar()}

        <section className="dashboard-hero">
          <div>
            <p className="eyebrow">AI Producer</p>
            <h1>Interview Prep</h1>
            <p>
              Build a guest profile, then generate questions, follow-ups, intros,
              teases, and if-time-allows questions.
            </p>
          </div>

          <button
            type="button"
            onClick={() => generateInterviewAsset("Interview Questions")}
            disabled={isInterviewGenerating}
          >
            {isInterviewGenerating ? "Generating..." : "Generate Questions"}
          </button>
        </section>

        <section className="interview-layout">
          <section className="panel">
            <div className="panel-title-row">
              <div>
                <h2>Guest Information</h2>
                <p>Fill in whatever you know. Empty fields are okay.</p>
              </div>
            </div>

            <div className="input-grid interview-grid">
              <label>
                Guest Name
                <input
                  value={interviewDraft.guestName}
                  onChange={(event) =>
                    updateInterviewDraft("guestName", event.target.value)
                  }
                  placeholder="Guest name"
                />
              </label>

              <label>
                Title / Role
                <input
                  value={interviewDraft.guestTitle}
                  onChange={(event) =>
                    updateInterviewDraft("guestTitle", event.target.value)
                  }
                  placeholder="Author, coach, mayor, expert..."
                />
              </label>

              <label>
                Organization
                <input
                  value={interviewDraft.organization}
                  onChange={(event) =>
                    updateInterviewDraft("organization", event.target.value)
                  }
                  placeholder="Company, church, nonprofit, team..."
                />
              </label>

              <label>
                Segment Length
                <input
                  value={interviewDraft.segmentLength}
                  onChange={(event) =>
                    updateInterviewDraft("segmentLength", event.target.value)
                  }
                  placeholder="8 minutes"
                />
              </label>

              <label className="wide">
                Interview Topic
                <input
                  value={interviewDraft.topic}
                  onChange={(event) =>
                    updateInterviewDraft("topic", event.target.value)
                  }
                  placeholder="What is the interview about?"
                />
              </label>

              <label className="wide">
                Why It Matters Now
                <textarea
                  value={interviewDraft.reason}
                  onChange={(event) =>
                    updateInterviewDraft("reason", event.target.value)
                  }
                  placeholder="Why are they coming on now? What makes this timely?"
                />
              </label>

              <label className="wide">
                Guest Background
                <textarea
                  value={interviewDraft.bio}
                  onChange={(event) =>
                    updateInterviewDraft("bio", event.target.value)
                  }
                  placeholder="Bio, credibility, story, past appearances, books, links, etc."
                />
              </label>

              <label>
                Audience
                <input
                  value={interviewDraft.audience}
                  onChange={(event) =>
                    updateInterviewDraft("audience", event.target.value)
                  }
                />
              </label>

              <label>
                Tone
                <input
                  value={interviewDraft.tone}
                  onChange={(event) =>
                    updateInterviewDraft("tone", event.target.value)
                  }
                />
              </label>

              <label className="wide">
                Must Ask
                <textarea
                  value={interviewDraft.mustAsk}
                  onChange={(event) =>
                    updateInterviewDraft("mustAsk", event.target.value)
                  }
                  placeholder="Questions or angles that must be included."
                />
              </label>

              <label className="wide">
                Avoid
                <textarea
                  value={interviewDraft.avoid}
                  onChange={(event) =>
                    updateInterviewDraft("avoid", event.target.value)
                  }
                  placeholder="Anything to avoid, sensitive areas, off-limits topics."
                />
              </label>

              <label className="wide">
                Contact / Notes
                <textarea
                  value={interviewDraft.contact}
                  onChange={(event) =>
                    updateInterviewDraft("contact", event.target.value)
                  }
                  placeholder="Email, phone, publicist, booking notes, pronunciation, etc."
                />
              </label>
            </div>
          </section>

          <aside className="interview-output-panel">
            <div className="content-bank-header">
              <div>
                <p className="eyebrow">Local AI</p>
                <h2>Interview Tools</h2>
              </div>
            </div>

            <div className="interview-tool-grid">
              <button
                type="button"
                onClick={() => generateInterviewAsset("Interview Questions")}
                disabled={isInterviewGenerating}
              >
                Generate Interview Questions
              </button>
              <button
                type="button"
                onClick={() => generateInterviewAsset("Follow-Up Questions")}
                disabled={isInterviewGenerating}
              >
                Generate Follow-Up Questions
              </button>
              <button
                type="button"
                onClick={() => generateInterviewAsset("Guest Intro")}
                disabled={isInterviewGenerating}
              >
                Generate Guest Intro
              </button>
              <button
                type="button"
                onClick={() => generateInterviewAsset("Segment Tease")}
                disabled={isInterviewGenerating}
              >
                Generate Segment Tease
              </button>
              <button
                type="button"
                onClick={() =>
                  generateInterviewAsset("If Time Allows Questions")
                }
                disabled={isInterviewGenerating}
              >
                Generate If-Time-Allows Questions
              </button>
            </div>

            <div className="ollama-note">
              Uses local Ollama when it is running. If it is not running yet,
              PrepDeck still creates a structured starter draft.
            </div>

            {interviewOutput ? (
              <div className="interview-result">
                <div className="section-title-row">
                  <h3>{interviewOutputTitle}</h3>
                  <button type="button" onClick={addInterviewOutputToBreak}>
                    Add to Selected Break
                  </button>
                </div>
                <pre>{interviewOutput}</pre>
              </div>
            ) : (
              <p className="small-muted">
                Generate an item and the result will appear here.
              </p>
            )}
          </aside>
        </section>
      </main>
    );
  }

  if (screen === "dashboard") {
    return (
      <main className="app-shell">
        {renderSidebar()}
        <section className="dashboard-hero">
          <div>
            <p className="eyebrow">PrepDeck</p>
            <h1>Shows</h1>
            <p>Choose a show, edit templates, or start today’s prep.</p>
          </div>
          <button type="button" onClick={() => setShowCreatorOpen(true)}>
            Create New Show
          </button>
        </section>

        {showCreatorOpen ? (
          <section className="panel">
            <h2>Create Show</h2>
            <div className="input-grid show-create-grid">
              <label>
                Show Name
                <input
                  value={showDraft.showName}
                  onChange={(event) =>
                    setShowDraft((current) => ({
                      ...current,
                      showName: event.target.value,
                    }))
                  }
                  placeholder="Morning Show"
                />
              </label>
              <label>
                Initial Template
                <input
                  value={initialTemplateName}
                  onChange={(event) => setInitialTemplateName(event.target.value)}
                />
              </label>
              <label>
                Host / DJ
                <input
                  value={showDraft.hostName}
                  onChange={(event) =>
                    setShowDraft((current) => ({
                      ...current,
                      hostName: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Station
                <input
                  value={showDraft.stationName}
                  onChange={(event) =>
                    setShowDraft((current) => ({
                      ...current,
                      stationName: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Market
                <input
                  value={showDraft.market}
                  onChange={(event) =>
                    setShowDraft((current) => ({
                      ...current,
                      market: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Start
                <input
                  value={showDraft.showStart}
                  onChange={(event) =>
                    setShowDraft((current) => ({
                      ...current,
                      showStart: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                End
                <input
                  value={showDraft.showEnd}
                  onChange={(event) =>
                    setShowDraft((current) => ({
                      ...current,
                      showEnd: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Phone
                <input
                  value={showDraft.phoneLine}
                  onChange={(event) =>
                    setShowDraft((current) => ({
                      ...current,
                      phoneLine: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="action-row">
              <button type="button" onClick={createShow}>
                Create Show
              </button>
              <button type="button" onClick={() => setShowCreatorOpen(false)}>
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        <section className="show-grid">
          {shows.map((show) => (
            <article className="show-card" key={show.id}>
              <div className="show-card-top">
                <div>
                  <h2>{show.name}</h2>
                  <p>
                    {show.settings.stationName || "Station not set"}
                    {show.settings.market ? ` · ${show.settings.market}` : ""}
                  </p>
                </div>
              </div>

              <div className="template-create-row">
                <input
                  value={templateNameDraft}
                  onChange={(event) => setTemplateNameDraft(event.target.value)}
                  placeholder="New template name"
                />
                <button type="button" onClick={() => addTemplate(show.id)}>
                  Add Template
                </button>
              </div>

              <div className="template-list">
                {show.templates.map((template) => (
                  <div className="template-row" key={template.id}>
                    <div>
                      <strong>{template.name}</strong>
                      <span>{template.breaks.length} breaks</span>
                    </div>
                    <div className="row-actions">
                      <button
                        type="button"
                        onClick={() => openTemplate(show, template)}
                      >
                        Edit Template
                      </button>
                      <button
                        type="button"
                        onClick={() => startDailyPrep(show, template)}
                      >
                        Start Today’s Prep
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
                ))}
              </div>
            </article>
          ))}
        </section>
      </main>
    );
  }

  if (screen === "template") {
    return (
      <main className="app-shell">
        {renderSidebar()}
        {renderShowHeader("Template Builder")}

        <section className="workspace-toolbar">
          <div>
            <strong>{activeTemplate?.name || "Template"}</strong>
            <span>Build the structure and save it to this template.</span>
          </div>

          <div className="toolbar-actions">
            <button type="button" onClick={() => setScreen("dashboard")}>
              Back to Shows
            </button>
            <button type="button" onClick={startDailyPrepFromCurrentTemplate}>
              Start Today’s Prep
            </button>
            <button type="button" onClick={saveSetupToTemplate}>
              Save Setup to Template
            </button>
          </div>
        </section>

        {renderContentFeedsPanel()}

        <section className="panel">
          <div className="panel-title-row">
            <div>
              <h2>Break Structure</h2>
              <p>Build the clock and recurring default notes for this template.</p>
            </div>
            <button type="button" onClick={addBreakBlock}>
              Add Break Block
            </button>
          </div>

          {breakCreatorOpen ? (
            <div className="inline-create">
              <label>
                Break Time
                <input
                  value={breakDraft.time}
                  onChange={(event) =>
                    setBreakDraft((current) => ({
                      ...current,
                      time: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Break Title
                <input
                  value={breakDraft.title}
                  onChange={(event) =>
                    setBreakDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
              <button type="button" onClick={saveBreakBlock}>
                Save Break
              </button>
            </div>
          ) : null}

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
                    onClick={() => removeBreak(block.id)}
                  >
                    Delete
                  </button>
                </div>

                {noteCreatorBreakId === block.id ? (
                  <div className="inline-note">
                    <label>
                      Note Title
                      <input
                        value={noteDraft.title}
                        onChange={(event) =>
                          setNoteDraft((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Note
                      <textarea
                        value={noteDraft.body}
                        onChange={(event) =>
                          setNoteDraft((current) => ({
                            ...current,
                            body: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button type="button" onClick={() => saveNoteToBreak(block.id)}>
                      Save Note
                    </button>
                  </div>
                ) : null}

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
                        onClick={() => removeTemplateItem(block.id, item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
        {renderSidebar()}
      {renderShowHeader("Daily Prep")}

      <section className="workspace-toolbar daily-toolbar">
        <div className="daily-toolbar-fields">
          <label>
            Station Priority
            <input
              value={dailyStationPriority}
              onChange={(event) => setDailyStationPriority(event.target.value)}
              placeholder="Main thing the station needs pushed today"
            />
          </label>
          <label>
            Contest Reminder
            <input
              value={dailyContestReminder}
              onChange={(event) => setDailyContestReminder(event.target.value)}
              placeholder="Contest, giveaway, caller number, sponsor note"
            />
          </label>
        </div>

        <div className="toolbar-actions">
          <button type="button" onClick={() => setScreen("dashboard")}>
            Back to Shows
          </button>
          <button type="button" onClick={refreshAllSources}>
            Refresh Sources
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
      </section>

      <section className="daily-layout">
        <aside className="content-bank">
          <div className="content-bank-header">
            <div>
              <p className="eyebrow">Daily Content</p>
              <h2>Content Bank</h2>
            </div>
            <button type="button" onClick={refreshAllSources}>
              Refresh
            </button>
          </div>

          <label>
            Add to Break
            <select
              value={dailySelectedBreakId}
              onChange={(event) => setDailySelectedBreakId(event.target.value)}
            >
              {dailyBreaks.map((block) => (
                <option key={block.id} value={block.id}>
                  {block.time} — {block.title}
                </option>
              ))}
            </select>
          </label>

          <div className="daily-tabs">
            <button
              type="button"
              className={activeDailyTab === "rss" ? "active" : ""}
              onClick={() => setActiveDailyTab("rss")}
            >
              RSS
            </button>
            <button
              type="button"
              className={activeDailyTab === "weather" ? "active" : ""}
              onClick={() => setActiveDailyTab("weather")}
            >
              Weather
            </button>
            <button
              type="button"
              className={activeDailyTab === "traffic" ? "active" : ""}
              onClick={() => setActiveDailyTab("traffic")}
            >
              Traffic
            </button>
            <button
              type="button"
              className={activeDailyTab === "calendar" ? "active" : ""}
              onClick={() => setActiveDailyTab("calendar")}
            >
              Calendar
            </button>
            <button
              type="button"
              className={activeDailyTab === "ai" ? "active" : ""}
              onClick={() => setActiveDailyTab("ai")}
            >
              AI Ideas
            </button>
          </div>

          {activeDailyTab === "rss" ? (
            <section className="bank-section">
              <div className="section-title-row">
                <h3>RSS Stories</h3>
                <button
                  type="button"
                  onClick={refreshRssFeeds}
                  disabled={isRefreshingRss}
                >
                  {isRefreshingRss ? "Refreshing..." : "Refresh RSS"}
                </button>
              </div>

              <div className="rss-filter-row">
                <button
                  type="button"
                  className={activeRssFilter === "all" ? "active" : ""}
                  onClick={() => setActiveRssFilter("all")}
                >
                  All Feeds
                </button>

                {feedCategories.map((category) => (
                  <button
                    type="button"
                    key={category}
                    className={activeRssFilter === `cat:${category}` ? "active" : ""}
                    onClick={() => setActiveRssFilter(`cat:${category}`)}
                  >
                    {category}
                  </button>
                ))}

                {activeFeeds.map((feed) => (
                  <button
                    type="button"
                    key={feed.id}
                    className={activeRssFilter === `feed:${feed.id}` ? "active" : ""}
                    onClick={() => setActiveRssFilter(`feed:${feed.id}`)}
                  >
                    {feed.name}
                  </button>
                ))}
              </div>

              {feedStatus ? <p className="status-line">{feedStatus}</p> : null}

              <div className="bank-list">
                {visibleRssStories.map((story) => (
                  <div className="bank-row" key={story.id}>
                    <div>
                      <strong>{story.title}</strong>
                      <span>
                        {story.feedName} · {story.category}
                      </span>
                      {story.summary ? <p>{story.summary}</p> : null}
                    </div>
                    <button type="button" onClick={() => addRssStoryToBreak(story)}>
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeDailyTab === "weather" ? (
            <section className="bank-section">
              <div className="section-title-row">
                <h3>Weather</h3>
                <button
                  type="button"
                  onClick={refreshWeather}
                  disabled={isRefreshingWeather}
                >
                  {isRefreshingWeather ? "Refreshing..." : "Refresh Weather"}
                </button>
              </div>

              <div className="bank-list">
                {activeWeatherLocations
                  .filter((location) => location.active)
                  .map((location) => (
                    <div className="bank-row" key={location.id}>
                      <div>
                        <strong>{location.label}</strong>
                        <span>{location.location}</span>
                        {location.lastRead ? <p>{location.lastRead}</p> : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => addWeatherToBreak(location)}
                      >
                        Add
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          ) : null}

          {activeDailyTab === "traffic" ? (
            <section className="bank-section">
              <div className="section-title-row">
                <h3>Traffic</h3>
                <button
                  type="button"
                  onClick={refreshTraffic}
                  disabled={isRefreshingTraffic}
                >
                  {isRefreshingTraffic ? "Refreshing..." : "Refresh Traffic"}
                </button>
              </div>

              <div className="bank-list">
                {activeTrafficAreas
                  .filter((area) => area.active)
                  .map((area) => (
                    <div className="bank-row" key={area.id}>
                      <div>
                        <strong>{area.label}</strong>
                        {area.lastRead ? <p>{area.lastRead}</p> : null}
                      </div>
                      <button type="button" onClick={() => addTrafficToBreak(area)}>
                        Add
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          ) : null}

          {activeDailyTab === "calendar" ? (
            <section className="bank-section">
              <h3>Community Calendar</h3>
              <div className="bank-list">
                {activeCommunityItems
                  .filter((item) => item.active)
                  .map((item) => (
                    <div className="bank-row" key={item.id}>
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
                        onClick={() => addCommunityToBreak(item)}
                      >
                        Add
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          ) : null}

          {activeDailyTab === "ai" ? (
            <section className="bank-section">
              <h3>AI Ideas</h3>
              <div className="input-grid two">
                <label>
                  Tool
                  <select value={aiTool} onChange={(event) => setAiTool(event.target.value)}>
                    <option>Topic Starter</option>
                    <option>Interview Questions</option>
                    <option>Promo Script</option>
                    <option>Contest Idea</option>
                    <option>Social Post</option>
                  </select>
                </label>
                <label>
                  Topic
                  <input
                    value={aiTopic}
                    onChange={(event) => setAiTopic(event.target.value)}
                    placeholder="Topic or segment idea"
                  />
                </label>
              </div>

              <div className="action-row">
                <button type="button" onClick={generateAiContent}>
                  Generate
                </button>
                <button type="button" onClick={addAiOutputToBreak}>
                  Add to Break
                </button>
              </div>

              {aiOutput ? <pre className="ai-output">{aiOutput}</pre> : null}
            </section>
          ) : null}
        </aside>

        <section className="daily-breaks">
          <div className="panel-title-row">
            <div>
              <h2>Today’s Breaks</h2>
              <p>Working rundown for today’s show.</p>
            </div>
          </div>

          <div className="break-list">
            {dailyBreaks.map((block) => (
              <article className="break-card" key={block.id}>
                <div className="break-card-top">
                  <input className="break-time" value={block.time} readOnly />
                  <input className="break-title" value={block.title} readOnly />
                  <button type="button" onClick={() => openDailyNoteForm(block.id)}>
                    Add Note
                  </button>
                  <button
                    type="button"
                    onClick={() => openDailyBreakOptionForm(block.id, "Show Focus")}
                  >
                    Add Focus
                  </button>
                  <button
                    type="button"
                    onClick={() => openDailyBreakOptionForm(block.id, "Tease / Promo")}
                  >
                    Add Tease
                  </button>
                </div>

                {dailyNoteCreatorBreakId === block.id ? (
                  <div className="inline-note">
                    <label>
                      Note Title
                      <input
                        value={dailyNoteDraft.title}
                        onChange={(event) =>
                          setDailyNoteDraft((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Note
                      <textarea
                        value={dailyNoteDraft.body}
                        onChange={(event) =>
                          setDailyNoteDraft((current) => ({
                            ...current,
                            body: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => saveDailyNoteToBreak(block.id)}
                    >
                      Save Note
                    </button>
                  </div>
                ) : null}

                {dailyBreakOptionDraft.blockId === block.id ? (
                  <div className="inline-note">
                    <label>
                      Item Title
                      <input
                        value={dailyBreakOptionDraft.title}
                        onChange={(event) =>
                          setDailyBreakOptionDraft((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Details
                      <textarea
                        value={dailyBreakOptionDraft.body}
                        onChange={(event) =>
                          setDailyBreakOptionDraft((current) => ({
                            ...current,
                            body: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button type="button" onClick={saveDailyBreakOptionToBreak}>
                      Save {dailyBreakOptionDraft.type}
                    </button>
                  </div>
                ) : null}

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
                        onClick={() => removeDailyItem(block.id, item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      {previewOpen ? (
        <div className="modal-backdrop">
          <section className="preview-card">
            <div className="modal-header">
              <h2>Preview</h2>
              <div className="row-actions">
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
                  <h1>{activeShow?.settings.showName || "Daily Prep"}</h1>
                  <p>
                    {activeTemplate?.name || "Template"} ·{" "}
                    {now.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <p>
                    {activeShow?.settings.stationName || ""}
                    {activeShow?.settings.market
                      ? ` · ${activeShow.settings.market}`
                      : ""}
                    {activeShow?.settings.hostName
                      ? ` · ${activeShow.settings.hostName}`
                      : ""}
                  </p>
                  <p>
                    {activeShow?.settings.textLine
                      ? `Text: ${activeShow.settings.textLine}`
                      : ""}
                    {activeShow?.settings.textLine &&
                    activeShow?.settings.phoneLine
                      ? " · "
                      : ""}
                    {activeShow?.settings.phoneLine
                      ? `Phone: ${activeShow.settings.phoneLine}`
                      : ""}
                  </p>
                </div>

                <div className="print-header-blocks">
                  {templateHeader.blocks.map((block, index) => {
                    const data = getHeaderBlockData(block);

                    return (
                      <div className="print-header-block" key={`${block}-${index}`}>
                        <strong>{data.title}</strong>
                        <span>{data.lines.join(" • ")}</span>
                      </div>
                    );
                  })}
                </div>
              </header>

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
