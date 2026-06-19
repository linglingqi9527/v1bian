const navSelectionFill = {
  fill: '#F7D95C',
  stroke: '#1f1f1f',
  strokeWidth: 2,
  fillStyle: 'hachure',
  fillWeight: 5.2,
  hachureAngle: -42,
  hachureGap: 11,
  roughness: 1.18,
  bowing: 1,
  overflow: 3,
}

const buttonSelectionFill = {
  fill: '#F7D95C',
  stroke: '#1f1f1f',
  strokeWidth: 2,
  fillStyle: 'hachure',
  fillWeight: 4.4,
  hachureAngle: -28,
  hachureGap: 10,
  roughness: 1.18,
  bowing: 1,
  overflow: 3,
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
