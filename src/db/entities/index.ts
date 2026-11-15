// Register every entity here — the DataSource reads this list (no globs: the bundler can't follow them).
import { CheckIn } from "./CheckIn";
import { Emergency } from "./Emergency";
import { HelpRequest } from "./HelpRequest";
import { VenueAlert } from "./VenueAlert";

export const entities = [Emergency, HelpRequest, CheckIn, VenueAlert];
export { CheckIn, Emergency, HelpRequest, VenueAlert };
