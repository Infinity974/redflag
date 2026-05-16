/**
 * RedFlag — Profils de Crush
 *
 * Note importante : les profils sont 100% cosmétiques.
 * Les traits sont tirés au hasard dans le pool global, donc
 * connaître le profil ne donne aucun avantage stratégique
 * (cf GDD section 3 et 8).
 */

export const CRUSH_PROFILES = [
  {
    id: 'BOBO_PARISIEN',
    displayName: 'Le Bobo Parisien',
    avatar: '💁‍♂️',
    tagline: "Vit dans le 11e, brunch obligatoire",
    themeColor: '#FF4FA3',
  },
  {
    id: 'SPORTIVE',
    displayName: 'La Sportive',
    avatar: '🏃‍♀️',
    tagline: "Marathon le matin, smoothie bowl le midi",
    themeColor: '#39FF6A',
  },
  {
    id: 'GEEK_INTROVERTI',
    displayName: 'Le Geek Introverti',
    avatar: '🤓',
    tagline: "T'envoie des memes à 2h du mat",
    themeColor: '#4FC3FF',
  },
  {
    id: 'INFLUENCEUSE',
    displayName: "L'Influenceuse Wellness",
    avatar: '🧘‍♀️',
    tagline: "Manifestation, sound bath et tisanes",
    themeColor: '#9B4FFF',
  },
  {
    id: 'PERE_CELIB',
    displayName: 'Le Père Célib',
    avatar: '👨‍👧',
    tagline: "Veuf depuis 2018, deux ados sympa",
    themeColor: '#FFD93D',
  },
  {
    id: 'CARRIERISTE',
    displayName: 'La Carriériste',
    avatar: '👩‍💼',
    tagline: "VP à 28 ans, bouge pas son agenda",
    themeColor: '#E63946',
  },
  {
    id: 'SPIRITUEL_VEGAN',
    displayName: 'Le Spirituel Vegan',
    avatar: '🌿',
    tagline: "Yoga le matin, ferments le soir",
    themeColor: '#9FE1CB',
  },
  {
    id: 'ARTISTE_NOMADE',
    displayName: "L'Artiste Nomade",
    avatar: '🎨',
    tagline: "Vit dans son van, peint ce qu'il voit",
    themeColor: '#FF6BB3',
  },
];

export function getCrushProfile(id) {
  return CRUSH_PROFILES.find(p => p.id === id) || null;
}

export function randomCrushProfile() {
  return CRUSH_PROFILES[Math.floor(Math.random() * CRUSH_PROFILES.length)];
}
