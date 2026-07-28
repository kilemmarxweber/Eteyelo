-- Allow half-step course weights (e.g. primary RDC maxPer 5 → ponderation 0.5).
ALTER TABLE "CoursOptionPonderation" ALTER COLUMN "ponderation" SET DATA TYPE DOUBLE PRECISION;
