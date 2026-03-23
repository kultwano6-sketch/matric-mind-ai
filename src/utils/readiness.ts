interface ReadinessData {
  tests: number;
  homework: number;
  past: number;
  consistency: number;
}

export const calculateScore = (data: ReadinessData): number => {
  return Math.round(
    data.tests * 0.3 +
    data.homework * 0.2 +
    data.past * 0.3 +
    data.consistency * 0.2
  );
};
