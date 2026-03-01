let zCounter = 25
const MAX_PANEL_Z = 998

export const getNextPanelZ = () => {
  zCounter = zCounter >= MAX_PANEL_Z ? 25 : zCounter + 1
  return zCounter
}
