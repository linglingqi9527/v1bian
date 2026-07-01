const navSelectionFill = {
  fill: '#F7D95C',
  stroke: '#1f1f1f',
  strokeWidth: 2,
  fillStyle: 'hachure',
  fillWeight: 3.1,
  hachureAngle: -45,
  hachureGap: 13.2,
  roughness: 1.62,
  bowing: 1.22,
  overflow: 3,
  texture: 'crayon',
  textureDensity: 42,
  textureOpacity: 0.76,
  textureStrokeWidth: 3.2,
}

const buttonSelectionFill = {
  fill: '#F7D95C',
  stroke: '#1f1f1f',
  strokeWidth: 2,
  fillStyle: 'hachure',
  fillWeight: 2.8,
  hachureAngle: -31,
  hachureGap: 12.4,
  roughness: 1.58,
  bowing: 1.2,
  overflow: 3,
  texture: 'crayon',
  textureDensity: 34,
  textureOpacity: 0.72,
  textureStrokeWidth: 2.9,
}

const compactSelectionFill = {
  fill: '#82BFFF',
  stroke: '#1f1f1f',
  strokeWidth: 1.8,
  fillStyle: 'hachure',
  fillWeight: 2.4,
  hachureAngle: -35,
  hachureGap: 7,
  roughness: 1.15,
  bowing: 1,
  overflow: 2,
  texture: 'none',
}

export const handdrawnPresets = {
  selectionFill: {
    ...buttonSelectionFill,
    fillWeight: 4,
  },
  navActiveFill: {
    ...navSelectionFill,
  },
  compactSelectionFill,
  tagActiveFill: compactSelectionFill,
  buttonActiveFill: {
    ...buttonSelectionFill,
  },
  stampFill: {
    fill: '#8EDB78',
    stroke: '#1f1f1f',
    strokeWidth: 2,
    fillStyle: 'hachure',
    fillWeight: 3,
    hachureAngle: -35,
    hachureGap: 7,
    roughness: 1.3,
    bowing: 1.1,
    overflow: 4,
  },
}

export const handdrawnToneFills = {
  blue: '#82BFFF',
  current: '#F7D95C',
  gray: '#D8D3C9',
  green: '#8EDB78',
  marked: '#82BFFF',
  pink: '#F58AB4',
  yellow: '#F7D95C',
}
