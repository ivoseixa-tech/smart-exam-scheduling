import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

function json(data, status=200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

async function authenticate(request) {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) throw new Error('Unauthorized');
  const token = auth.slice(7).trim();
  if (!token) throw new Error('Unauthorized');
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Unauthorized');
  const user = await res.json();
  if (!user?.id) throw new Error('Unauthorized');
  const roleRes = await fetch(`${base}/rest/v1/rpc/has_role`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ _user_id: user.id, _role: 'master' }),
  });
  if (!roleRes.ok || (await roleRes.json()) !== true) throw new Error('Acesso permitido somente ao usuário mestre.');
  return user.id;
}

function validateInput(data) {
  if (!data || typeof data !== 'object') throw new Error('Dados inválidos.');
  for (const key of ['name','street','city','state','company_ids','schedule']) if (!(key in data)) throw new Error(`Campo obrigatório: ${key}.`);
  if (!Array.isArray(data.company_ids) || data.company_ids.length < 1) throw new Error('Informe ao menos uma empresa.');
  if (!Array.isArray(data.schedule) || data.schedule.length < 1) throw new Error('Informe ao menos um horário.');
  if (!/^[A-Za-z]{2}$/.test(String(data.state))) throw new Error('Estado inválido.');
  for (const r of data.schedule) {
    if (!Number.isInteger(r.weekday) || r.weekday < 0 || r.weekday > 6) throw new Error('Dia da semana inválido.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.start_time) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.end_time)) throw new Error('Horário inválido.');
    if (r.start_time >= r.end_time) throw new Error('O horário inicial deve ser menor que o final.');
    if (!Number.isInteger(r.slot_minutes) || r.slot_minutes < 5 || r.slot_minutes > 240) throw new Error('Duração inválida.');
  }
}

async function listClinics() {
  const { rows } = await pool.query(`
    SELECT c.id,c.name,c.street,c.number,c.complement,c.district,c.city,c.state,c.postal_code,c.phone,c.is_active,c.created_at,
      COALESCE((SELECT json_agg(json_build_object('location_id',cc.clinic_id,'company_id',cc.company_id) ORDER BY cc.company_id) FROM public.clinic_companies cc WHERE cc.clinic_id=c.id),'[]'::json) AS companies,
      COALESCE((SELECT json_agg(json_build_object('id',sr.id,'location_id',sr.clinic_id,'weekday',sr.weekday,'start_time',sr.start_time,'end_time',sr.end_time,'slot_minutes',sr.slot_minutes,'is_active',sr.is_active) ORDER BY sr.weekday,sr.start_time) FROM public.clinic_schedule_rules sr WHERE sr.clinic_id=c.id AND sr.is_active=true),'[]'::json) AS schedule_rules
    FROM public.clinics c ORDER BY c.name`);
  return rows;
}

async function createClinic(data, userId) {
  validateInput(data);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dup = await client.query(`SELECT id FROM public.clinics WHERE lower(name)=lower($1) AND lower(city)=lower($2) AND state=$3 LIMIT 1`, [data.name.trim(),data.city.trim(),String(data.state).toUpperCase()]);
    if (dup.rows.length) throw new Error('Já existe uma clínica com este nome nesta cidade.');
    const clinic = await client.query(`INSERT INTO public.clinics (name,street,number,complement,district,city,state,postal_code,phone,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, [data.name.trim(),data.street.trim(),data.number?.trim()||null,data.complement?.trim()||null,data.district?.trim()||null,data.city.trim(),String(data.state).toUpperCase(),data.postal_code?.trim()||null,data.phone?.trim()||null,userId]);
    const clinicId=clinic.rows[0].id;
    for (const companyId of data.company_ids) await client.query(`INSERT INTO public.clinic_companies (clinic_id,company_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,[clinicId,companyId]);
    for (const r of data.schedule) await client.query(`INSERT INTO public.clinic_schedule_rules (clinic_id,weekday,start_time,end_time,slot_minutes) VALUES ($1,$2,$3,$4,$5)`,[clinicId,r.weekday,r.start_time,r.end_time,r.slot_minutes]);
    const { rowCount } = await client.query(`
      INSERT INTO public.clinic_slots (clinic_id,starts_at,ends_at)
      SELECT $1,s,s+make_interval(mins=>r.slot_minutes)
      FROM public.clinic_schedule_rules r
      CROSS JOIN LATERAL generate_series(
        current_date + ((r.weekday-extract(dow from current_date)::int+7)%7),
        current_date + 179,
        interval '7 day'
      ) d
      CROSS JOIN LATERAL generate_series(d+r.start_time,d+r.end_time-make_interval(mins=>r.slot_minutes),make_interval(mins=>r.slot_minutes)) s
      WHERE r.clinic_id=$1 AND r.is_active=true
      ON CONFLICT (clinic_id,starts_at) DO NOTHING`,[clinicId]);
    await client.query('COMMIT');
    return { ok:true, clinicId, slotCount:rowCount ?? 0 };
  } catch(e){ await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

export default async function fetch(request) {
  try {
    const userId = await authenticate(request);
    const url = new URL(request.url);
    if (request.method==='GET' && url.pathname==='/clinics') return json(await listClinics());
    if (request.method==='POST' && url.pathname==='/clinics') return json(await createClinic(await request.json(), userId));
    return json({error:'Not found'},404);
  } catch(e) {
    console.error(e);
    const msg=e instanceof Error?e.message:'Erro interno.';
    return json({error:msg},msg==='Unauthorized'?401:msg.includes('Acesso permitido')?403:500);
  }
}
