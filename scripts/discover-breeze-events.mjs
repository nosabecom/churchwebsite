import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BreezeReadOnlyClient,
  buildDiscoveryReport,
  renderDiscoveryMarkdown,
  validateDiscoveryRange,
} from "../packages/breeze-discovery/src/index.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutput = resolve(
  repositoryRoot,
  "tmp",
  "breeze-discovery",
  new Date().toISOString().replaceAll(":", "-").replace(".", "-"),
);

const logActions = [
  "event_created",
  "event_updated",
  "event_deleted",
  "event_instance_deleted",
  "event_future_deleted",
  "events_calendar_created",
  "events_calendar_updated",
  "events_calendar_deleted",
];

const usage = `Usage:
  pnpm breeze:discover -- --start YYYY-MM-DD --end YYYY-MM-DD [--output PATH]

Required environment variables:
  BREEZE_ACCOUNT_SUBDOMAIN   Account subdomain only (for example, gracechurch)
  BREEZE_API_KEY             Server-only Breeze API key

Safety controls:
  - GET-only endpoint allowlist
  - 1 second minimum between requests
  - at most 18 requests in any rolling minute and 18 requests per run
  - no redirects and no raw-response persistence
  - output inside this repository is restricted to the ignored tmp/ directory
`;

const parseArguments = (arguments_) => {
  const options = {};
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (!new Set(["--start", "--end", "--output"]).has(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = arguments_[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    options[argument.slice(2)] = value;
    index += 1;
  }
  if (!options.start || !options.end) {
    throw new Error("Both --start and --end are required.");
  }
  return options;
};

const resolveOutputDirectory = (value) => {
  const output = value
    ? isAbsolute(value)
      ? resolve(value)
      : resolve(repositoryRoot, value)
    : defaultOutput;
  const insideRepository = relative(repositoryRoot, output);
  const insideTemporaryDirectory = relative(resolve(repositoryRoot, "tmp"), output);
  const isInsideRepository =
    insideRepository === "" ||
    (!insideRepository.startsWith("..") && !isAbsolute(insideRepository));
  const isInsideTemporaryDirectory =
    insideTemporaryDirectory === "" ||
    (!insideTemporaryDirectory.startsWith("..") &&
      !isAbsolute(insideTemporaryDirectory));

  if (isInsideRepository && !isInsideTemporaryDirectory) {
    throw new Error(
      "Discovery output inside the repository must be written below the ignored tmp/ directory.",
    );
  }
  return output;
};

const records = (value) => {
  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === "object" && !Array.isArray(item));
  }
  return value && typeof value === "object" ? [value] : [];
};

const selectDetailSamples = (eventRecords) => {
  const seriesCounts = new Map();
  for (const event of eventRecords) {
    const seriesId = String(event.event_id ?? "");
    if (seriesId) seriesCounts.set(seriesId, (seriesCounts.get(seriesId) ?? 0) + 1);
  }

  const candidates = [
    eventRecords.find((event) => String(event.is_modified) === "1"),
    eventRecords.find((event) => (seriesCounts.get(String(event.event_id)) ?? 0) > 1),
    eventRecords[0],
  ].filter(Boolean);

  return [...new Map(candidates.map((event) => [String(event.id), event])).values()]
    .filter((event) => /^\d+$/.test(String(event.id)))
    .slice(0, 3);
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage);
    return;
  }

  const range = validateDiscoveryRange(options.start, options.end);
  const outputDirectory = resolveOutputDirectory(options.output);
  const subdomain = process.env.BREEZE_ACCOUNT_SUBDOMAIN ?? "";
  const apiKey = process.env.BREEZE_API_KEY ?? "";
  const client = new BreezeReadOnlyClient({
    subdomain,
    apiKey,
    maximumRequests: 18,
    maximumRequestsPerMinute: 18,
    onRequest: ({ number, endpoint }) => {
      console.log(`[${number}/18] GET ${endpoint}`);
    },
  });

  console.log(
    `Starting read-only Breeze discovery for ${range.start} through ${range.end} (${range.days} days).`,
  );
  const account = await client.accountSummary();
  const accountRecord = records(account)[0] ?? {};
  if (
    typeof accountRecord.subdomain !== "string" ||
    accountRecord.subdomain.toLowerCase() !== subdomain.trim().toLowerCase()
  ) {
    throw new Error(
      "The account summary did not match BREEZE_ACCOUNT_SUBDOMAIN; discovery stopped before event access.",
    );
  }

  const calendars = await client.calendars();
  const locations = await client.locations();
  const events = await client.events(range);
  const eventRecords = records(events);
  const samples = selectDetailSamples(eventRecords);
  const eventDetails = [];
  for (const sample of samples) {
    eventDetails.push(
      await client.event({
        instanceId: String(sample.id),
        details: true,
        eligible: true,
      }),
    );
  }

  const recurringSample = samples.find((event) =>
    eventRecords.some(
      (candidate) =>
        candidate !== event && String(candidate.event_id) === String(event.event_id),
    ),
  );
  const schedules = [];
  if (recurringSample) {
    for (const direction of ["before", "after"]) {
      schedules.push({
        instanceId: String(recurringSample.id),
        direction,
        response: await client.event({
          instanceId: String(recurringSample.id),
          details: false,
          eligible: false,
          schedule: true,
          scheduleDirection: direction,
          scheduleLimit: 20,
        }),
      });
    }
  }

  const logs = {};
  for (const action of logActions) {
    logs[action] = await client.accountLog({ ...range, action, limit: 50 });
  }

  const report = buildDiscoveryReport({
    configuredSubdomain: subdomain,
    ...range,
    account,
    calendars,
    locations,
    events,
    eventDetails,
    schedules,
    logs,
    requestCount: client.requestCount,
  });
  const markdown = renderDiscoveryMarkdown(report);

  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  await Promise.all([
    writeFile(
      resolve(outputDirectory, "report.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      { mode: 0o600 },
    ),
    writeFile(resolve(outputDirectory, "report.md"), markdown, { mode: 0o600 }),
  ]);

  console.log(`Wrote redacted reports to ${outputDirectory}`);
  console.log("No raw API response was persisted and no Sanity API was called.");

  if (eventRecords.length >= 1_000) {
    throw new Error(
      "The event response reached Breeze's 1000-row maximum; split the date range before approving the report.",
    );
  }
};

main().catch((error) => {
  console.error(`Breeze discovery failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
