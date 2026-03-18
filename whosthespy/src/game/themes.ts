import type { Theme } from './types';

export const THEMES: Theme[] = [
  {
    id: 'foods',
    name: 'Foods & Drinks',
    words: [
      'coffee',
      'burger',
      'pasta',
      'sushi',
      'salad',
      'tea',
      'pizza',
      'taco',
      'soup',
      'lemon',
      'cheese',
      'cookie',
    ],
  },
  {
    id: 'animals',
    name: 'Animals',
    words: [
      'lion',
      'tiger',
      'rabbit',
      'eagle',
      'shark',
      'horse',
      'panda',
      'whale',
      'camel',
      'otter',
      'zebra',
      'wolf',
    ],
  },
  {
    id: 'countries',
    name: 'Countries',
    words: [
      'canada',
      'japan',
      'brazil',
      'egypt',
      'france',
      'mexico',
      'india',
      'italy',
      'norway',
      'spain',
      'kenya',
      'chile',
    ],
  },
  {
    id: 'jobs',
    name: 'Jobs',
    words: [
      'teacher',
      'pilot',
      'doctor',
      'chef',
      'lawyer',
      'nurse',
      'farmer',
      'designer',
      'actor',
      'dentist',
      'driver',
      'builder',
    ],
  },
];

export function getThemeById(themeId: Theme['id']) {
  return THEMES.find((theme) => theme.id === themeId) ?? null;
}
