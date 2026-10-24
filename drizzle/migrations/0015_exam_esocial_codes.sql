ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS esocial_code text;
ALTER TABLE public.exams ADD CONSTRAINT exams_esocial_code_format CHECK (esocial_code IS NULL OR esocial_code ~ '^[0-9]{4}$');
UPDATE public.exams SET esocial_code = v.code FROM (VALUES
 ('Exame clínico ocupacional','0295'),('Avaliação de mudança de risco','0295'),('Avaliação de retorno ao trabalho','0295'),
 ('Acuidade visual','9999'),('Audiometria ocupacional','0281'),('Avaliação psicossocial','0289'),('Eletrocardiograma','0530'),
 ('Eletroencefalograma','0536'),('Espirometria','1057'),('Glicemia em jejum','0658'),('Hemograma completo','0693'),('Raio-X de tórax','1078')
) AS v(name, code) WHERE exams.name_pt = v.name AND exams.esocial_code IS NULL;