UPDATE "period"
SET "label" = CASE "label"
  WHEN '1st Period' THEN '1ere Periode'
  WHEN '1er Periode' THEN '1ere Periode'
  WHEN '2nd Period' THEN '2e Periode'
  WHEN '3tr Period' THEN '3e Periode'
  WHEN '4th Period' THEN '4e Periode'
  WHEN 'Exam 1st semester' THEN 'Examen 1er semestre'
  WHEN 'Exam 2nd semester' THEN 'Examen 2e semestre'
  WHEN 'Exam 1er trimestre' THEN 'Examen 1er trimestre'
  WHEN 'Exam 2e trimestre' THEN 'Examen 2e trimestre'
  WHEN 'Exam 3e trimestre' THEN 'Examen 3e trimestre'
  ELSE "label"
END
WHERE "label" IN (
  '1st Period',
  '1er Periode',
  '2nd Period',
  '3tr Period',
  '4th Period',
  'Exam 1st semester',
  'Exam 2nd semester',
  'Exam 1er trimestre',
  'Exam 2e trimestre',
  'Exam 3e trimestre'
);

UPDATE "fiche"
SET "periodeName" = CASE "periodeName"
  WHEN '1st Period' THEN '1ere Periode'
  WHEN '1er Periode' THEN '1ere Periode'
  WHEN '2nd Period' THEN '2e Periode'
  WHEN '3tr Period' THEN '3e Periode'
  WHEN '4th Period' THEN '4e Periode'
  WHEN 'Exam 1st semester' THEN 'Examen 1er semestre'
  WHEN 'Exam 2nd semester' THEN 'Examen 2e semestre'
  WHEN 'Exam 1er trimestre' THEN 'Examen 1er trimestre'
  WHEN 'Exam 2e trimestre' THEN 'Examen 2e trimestre'
  WHEN 'Exam 3e trimestre' THEN 'Examen 3e trimestre'
  ELSE "periodeName"
END
WHERE "periodeName" IN (
  '1st Period',
  '1er Periode',
  '2nd Period',
  '3tr Period',
  '4th Period',
  'Exam 1st semester',
  'Exam 2nd semester',
  'Exam 1er trimestre',
  'Exam 2e trimestre',
  'Exam 3e trimestre'
);
