import allocine from './sources/allocine.ts';
import brocabrac from './sources/brocabrac.ts';
import morbihan from './sources/morbihan.ts';
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
export const sources: Source[] = [
  brocabrac({ department: '56' }),
  // The films in original version of the coming week. Coordinates from api-adresse.data.gouv.fr.
  allocine({
    days: 7,
    theaters: [
      { id: 'P9556', name: 'CGR Lanester', address: 'Rue Gustave Zédé, zone du Manébos', place: 'Lanester', lat: 47.775337, lon: -3.355623 },
      { id: 'P0766', name: 'Cinéville Lorient', address: '4 boulevard Joffre', place: 'Lorient', lat: 47.751774, lon: -3.365372 },
      { id: 'P0591', name: 'Ti Hanok', address: "Place de l'Europe", place: 'Auray', lat: 47.669841, lon: -3.008386 },
    ],
  }),
  morbihan(),
];
