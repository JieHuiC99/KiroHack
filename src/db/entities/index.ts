// Register every entity here — the DataSource reads this list (no globs: the bundler can't follow them).
import { CheckIn } from "./CheckIn";
import { Emergency } from "./Emergency";
import { HelpRequest } from "./HelpRequest";

export const entities = [Emergency, HelpRequest, CheckIn];
export { CheckIn, Emergency, HelpRequest };
