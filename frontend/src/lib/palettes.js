export const palettes = [
  { id: 'blue', name: 'Blue', swatch: '#2e5bc8' },
  { id: 'slate', name: 'Slate', swatch: '#4a596c' },
  { id: 'violet', name: 'Violet', swatch: '#7644b3' },
  { id: 'forest', name: 'Forest', swatch: '#1b6949' }
];

const storageKey = 'smartbin.palette.v1';

export function loadPalette() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (palettes.some(palette => palette.id === saved)) return saved;
  } catch {
    // The default palette is available without browser storage.
  }
  return palettes[0].id;
}

export function savePalette(id) {
  try {
    localStorage.setItem(storageKey, id);
    return true;
  } catch {
    return false;
  }
}
