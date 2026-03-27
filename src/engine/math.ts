export const powInt = (base: number, exp: number): number => {
  if (exp < 0) throw new Error('exp must be non-negative');
  let out = 1;
  for (let i = 0; i < exp; i += 1) out *= base;
  return out;
};

export const coordsToIndex = (coords: number[], size: number): number => {
  let index = 0;
  let mul = 1;
  for (let i = 0; i < coords.length; i += 1) {
    index += coords[i] * mul;
    mul *= size;
  }
  return index;
};

export const indexToCoords = (index: number, dimensions: number, size: number): number[] => {
  const coords = new Array<number>(dimensions).fill(0);
  let n = index;
  for (let i = 0; i < dimensions; i += 1) {
    coords[i] = n % size;
    n = Math.floor(n / size);
  }
  return coords;
};

export const getAllDirections = (dimensions: number): number[][] => {
  const dirs: number[][] = [];
  for (let firstNonZero = 0; firstNonZero < dimensions; firstNonZero += 1) {
    const remainingDims = dimensions - firstNonZero - 1;
    const combos = powInt(3, remainingDims);
    for (let c = 0; c < combos; c += 1) {
      const d = new Array<number>(dimensions).fill(0);
      d[firstNonZero] = 1;
      let temp = c;
      for (let i = 0; i < remainingDims; i += 1) {
        d[firstNonZero + 1 + i] = (temp % 3) - 1;
        temp = Math.floor(temp / 3);
      }
      dirs.push(d);
    }
  }
  return dirs;
};

export const isInBounds = (coords: number[], size: number): boolean => coords.every((c) => c >= 0 && c < size);
