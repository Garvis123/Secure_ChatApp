export const detectAnomaly = (data) => {
  const avg = data.reduce((a, b) => a + b, 0) / data.length;
  return data.filter((x) => Math.abs(x - avg) > avg * 0.2);
};
