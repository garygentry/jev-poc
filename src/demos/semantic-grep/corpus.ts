import type { JevState } from "@shared/jev.ts"

/** One function to search, with the verdict a careful reader would give it. */
export interface Fn {
  id: string
  name: string
  /** The function source, as a grep hit would show it. */
  code: string
  /** Whether it actually matches the rule, for the reader. Not sent to the model. */
  truth: boolean
  /** Why. Not sent to the model. */
  note: string
}

/**
 * The rule, stated in English — the thing a regex cannot say.
 *
 * "A network call" has a dozen syntaxes and "without a timeout" is about what is
 * *absent*, across all of them. Shown in the UI so the search is legible, and
 * folded into the question so the gate judges each function against it.
 */
export const RULE =
  "The function makes a network request (fetch, an HTTP client, or a request library) without configuring any timeout."

/**
 * A plausible hand-written attempt at that rule.
 *
 * It is a fair try, not a strawman: it looks for the two commonest network
 * calls. It still fails in both directions a syntactic match must — it cannot
 * see the timeout, so it flags calls that set one, and it does not know the
 * request libraries it was not told about, so it misses those. Writing one regex
 * that gets "network call" *and* "no timeout" right is the thing nobody can do.
 */
export const REGEX = /\bfetch\(|\baxios\b/

export const regexMatches = (fn: Fn): boolean => REGEX.test(fn.code)

/** What the gate judges: the function, against the rule in the question. */
export const stateFor = (fn: Fn): JevState => ({ name: fn.name, code: fn.code })

/** A module to search: a set of functions the fan-out runs the rule over. */
export interface Search {
  id: string
  label: string
  functions: Fn[]
}

/**
 * Nine functions: four that match the rule and five that do not, arranged so a
 * regex gets several wrong in both directions.
 *
 * The matches use three different network syntaxes (fetch, axios, a request
 * library) so no one pattern catches them all; the non-matches include calls
 * that *do* set a timeout — in three different ways — plus pure and file-I/O
 * functions a network pattern should never flag.
 */
export const FUNCTIONS: Fn[] = [
  {
    id: "fetchUser",
    name: "fetchUser",
    code: "async function fetchUser(id) {\n  const res = await fetch(`/api/users/${id}`)\n  return res.json()\n}",
    truth: true,
    note: "A fetch with no timeout — a match.",
  },
  {
    id: "fetchOrders",
    name: "fetchOrders",
    code: "async function fetchOrders(userId) {\n  const res = await fetch(`/api/orders?u=${userId}`, {\n    signal: AbortSignal.timeout(5000),\n  })\n  return res.json()\n}",
    truth: false,
    note: "A fetch, but it sets a timeout via AbortSignal — not a match, though the regex flags it.",
  },
  {
    id: "getWeather",
    name: "getWeather",
    code: "async function getWeather(city) {\n  const { data } = await axios.get(`/weather/${city}`)\n  return data\n}",
    truth: true,
    note: "An axios call with no timeout — a match.",
  },
  {
    id: "postEvent",
    name: "postEvent",
    code: "async function postEvent(evt) {\n  await axios.post('/events', evt, { timeout: 2000 })\n}",
    truth: false,
    note: "axios, but with a timeout option — not a match, though the regex flags it.",
  },
  {
    id: "download",
    name: "download",
    code: "async function download(url) {\n  const buf = await got(url).buffer()\n  return buf\n}",
    truth: true,
    note: "A network call via got() with no timeout — a match the regex never sees.",
  },
  {
    id: "pingHost",
    name: "pingHost",
    code: "function pingHost(url) {\n  const req = http.get(url, onResponse)\n  req.setTimeout(3000, () => req.destroy())\n}",
    truth: false,
    note: "A network call, but it sets a timeout via req.setTimeout — not a match.",
  },
  {
    id: "sum",
    name: "sum",
    code: "function sum(xs) {\n  return xs.reduce((a, b) => a + b, 0)\n}",
    truth: false,
    note: "Pure — no network at all.",
  },
  {
    id: "loadConfig",
    name: "loadConfig",
    code: "function loadConfig(path) {\n  return JSON.parse(fs.readFileSync(path, 'utf8'))\n}",
    truth: false,
    note: "File I/O, not a network call.",
  },
  {
    id: "scrape",
    name: "scrape",
    code: "async function scrape(urls) {\n  const out = []\n  for (const u of urls) out.push(await fetch(u))\n  return out\n}",
    truth: true,
    note: "A fetch in a loop with no timeout — a match.",
  },
]

/**
 * The module the search runs over. One example, because the rule is fixed and
 * the point is the fan-out across its functions, not a menu of inputs.
 */
export const SEARCHES: Search[] = [
  { id: "http-client", label: "http-client.ts", functions: FUNCTIONS },
]
