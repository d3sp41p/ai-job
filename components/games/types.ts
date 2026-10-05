export type GameProps = {
  // performance: 0..1, summary: one line shown on the result screen
  onFinish: (performance: number, summary: string) => void;
};
