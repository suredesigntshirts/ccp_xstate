// Preload for the host process only: moves its clock VFRW_CLOCK_OFFSET_MS ahead, so a test can deliver a reminder
// "an hour later" without waiting an hour. Nothing else about the host changes.
const off = Number(process.env.VFRW_CLOCK_OFFSET_MS || 0);
const Real = Date;
class Shifted extends Real {
  constructor(...a) { if (a.length === 0) super(Real.now() + off); else super(...a); }
  static now() { return Real.now() + off; }
}
globalThis.Date = Shifted;
