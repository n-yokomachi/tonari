module.exports = {
  createCanvas: jest.fn(() => ({
    getContext: jest.fn(() => ({
      measureText: jest.fn(() => ({ width: 0 })),
      fillText: jest.fn(),
      fillRect: jest.fn(),
      drawImage: jest.fn(),
    })),
    toBuffer: jest.fn(() => Buffer.from([])),
    toDataURL: jest.fn(() => ''),
    width: 100,
    height: 100,
  })),
  loadImage: jest.fn(() => Promise.resolve({ width: 100, height: 100 })),
  registerFont: jest.fn(),
}
