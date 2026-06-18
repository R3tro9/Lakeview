import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const respond = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const payload = await req.json()
    const { action, org_id } = payload

    async function getCreds() {
      const { data, error } = await sb.from('connector_credentials').select('credentials, sync_data').eq('org_id', org_id).eq('connector_id', 'papercut').single()
      if (error) throw error
      return data
    }

    function pcFetch(creds: any, path: string) {
      return fetch(`${creds.server}${path}`, {
        headers: { Authorization: creds.token },
      })
    }

    // ── TEST ──────────────────────────────────────────────────────────────────
    if (action === 'test') {
      const groups = [
        { id:'site1', name:'Lincoln High School',  printer_count:4 },
        { id:'site2', name:'Jefferson Middle',     printer_count:3 },
        { id:'site3', name:'Franklin Elementary',  printer_count:3 },
        { id:'site4', name:'District Office',      printer_count:2 },
      ]
      const printers = [
        { id:'pc001', name:'LHS\\\\Main-Office-Xerox',  server:'print.district.edu', location:'Lincoln HS - Main Office', group_id:'site1', status:'Idle',    total_pages:184221, color_pages:42018, error_pages:12, jobs_today:48,  disabled:false, color:true  },
        { id:'pc002', name:'LHS\\\\Library-BW',         server:'print.district.edu', location:'Lincoln HS - Library',      group_id:'site1', status:'Idle',    total_pages:302114, color_pages:0,     error_pages:2,  jobs_today:31,  disabled:false, color:false },
        { id:'pc003', name:'LHS\\\\TeacherLounge',      server:'print.district.edu', location:'Lincoln HS - Lounge',       group_id:'site1', status:'Error',   total_pages:91443,  color_pages:21033, error_pages:88, jobs_today:0,   disabled:false, color:true, error_msg:'Out of paper - Tray 1' },
        { id:'pc004', name:'JMS\\\\Office-Color',       server:'print.district.edu', location:'Jefferson MS - Office',     group_id:'site2', status:'Idle',    total_pages:121088, color_pages:31204, error_pages:5,  jobs_today:22,  disabled:false, color:true  },
        { id:'pc005', name:'FES\\\\Office-Color',       server:'print.district.edu', location:'Franklin ES - Office',      group_id:'site3', status:'Idle',    total_pages:88011,  color_pages:18200, error_pages:3,  jobs_today:18,  disabled:false, color:true  },
        { id:'pc006', name:'DO\\\\Admin-Main',          server:'print.district.edu', location:'District Office - Admin',   group_id:'site4', status:'Printing',total_pages:201108, color_pages:88041, error_pages:1,  jobs_today:67,  disabled:false, color:true  },
        { id:'pc007', name:'DO\\\\Finance',             server:'print.district.edu', location:'District Office - Finance', group_id:'site4', status:'Idle',    total_pages:55021,  color_pages:0,     error_pages:0,  jobs_today:9,   disabled:false, color:false },
      ]
      const top_users = [
        { username:'dlee@district.edu',    display_name:'Dana Lee',       pages_today:82,  pages_month:1204, color_pages:288,  cost_month:24.08 },
        { username:'sbrown@district.edu',  display_name:'Sarah Brown',    pages_today:44,  pages_month:880,  color_pages:120,  cost_month:15.60 },
        { username:'admin@district.edu',   display_name:'IT Admin',       pages_today:121, pages_month:2201, color_pages:1100, cost_month:48.02 },
        { username:'ltorres@district.edu', display_name:'L. Torres',      pages_today:28,  pages_month:512,  color_pages:64,   cost_month:8.48  },
        { username:'pjones@district.edu',  display_name:'P. Jones',       pages_today:55,  pages_month:901,  color_pages:180,  cost_month:18.00 },
      ]
      const summary = { total_pages_today:486, color_pages_today:112, total_pages_month:14801, color_pages_month:3218, jobs_in_queue:3, error_printers:1 }
      const sync_data = { groups, printers, top_users, summary, synced_at: new Date().toISOString() }
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'papercut', credentials:{ mode:'mock' }, status:'connected', sync_data, last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true, sync_data })
    }

    if (action === 'save') {
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'papercut', credentials:payload.credentials, status:'connected', last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true })
    }
    if (action === 'load') {
      const { data, error } = await sb.from('connector_credentials').select('sync_data, last_sync').eq('org_id', org_id).eq('connector_id', 'papercut').single()
      if (error) throw error
      return respond({ ok:true, ...data })
    }

    if (action === 'sync') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') throw new Error('Mock mode — use real PaperCut server and token')
      const res = await pcFetch(creds, '/api/stats/printer')
      if (!res.ok) throw new Error(`PaperCut API error: ${res.status}`)
      const data = await res.json()
      const printers = (data.printers || []).map((p: any) => ({
        id: p.printerName, name: p.printerName, server: p.serverName, location: p.location, status: p.disabled ? 'Disabled' : 'Idle', total_pages: p.totalPages, color_pages: p.totalColorPages, error_pages: p.totalErrorPages, jobs_today: p.jobsToday,
      }))
      const sync_data = { groups: [], printers, top_users: [], summary: {}, synced_at: new Date().toISOString() }
      await sb.from('connector_credentials').update({ sync_data, last_sync: new Date().toISOString() }).eq('org_id', org_id).eq('connector_id', 'papercut')
      return respond({ ok:true, counts: { printers: printers.length } })
    }

    throw new Error('Unknown action: ' + action)
  } catch (e: any) {
    return respond({ ok:false, error: e.message }, 400)
  }
})
