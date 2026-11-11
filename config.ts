import brocabrac from './sources/brocabrac.ts';
import type { Source } from './types.ts';

// Where distances are measured from: Landévant (56690), as api-adresse.data.gouv.fr places it
export const home = { name: 'Landévant', lat: 47.77442, lon: -3.118101 };

// Events farther than this are left out. An event without coordinates is kept: nothing says it is too far.
export const radiusKm = 25;

// How far ahead the page and the feeds look
export const horizonDays = 45;

// An event first seen this recently is marked as new on the page
export const newDays = 2;

// Where the Site workflow publishes the page, which the feeds link to
export const siteUrl = 'https://smndhm.github.io/events/';

// Every source read on each run. Adding a site means adding one file in sources/ and one line here.
export const sources: Source[] = [brocabrac({ department: '56' })];
