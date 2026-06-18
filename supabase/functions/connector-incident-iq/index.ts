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
    const { action, org_id, ticket_id } = payload

    async function getCreds() {
      const { data, error } = await sb.from('connector_credentials').select('credentials, sync_data').eq('org_id', org_id).eq('connector_id', 'incident-iq').single()
      if (error) throw error
      return data
    }

    function iiqFetch(creds: any, path: string, method = 'GET', body?: unknown) {
      return fetch(`${creds.url}/api/1${path}`, {
        method,
        headers: { 'x-api-key': creds.key, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
    }

    // ── TEST ──────────────────────────────────────────────────────────────────
    if (action === 'test') {
      const now = Date.now()
      const groups = [
        { id:'loc1', name:'Lincoln High School',   abbr:'LHS', ticket_count:18 },
        { id:'loc2', name:'Jefferson Middle',      abbr:'JMS', ticket_count:12 },
        { id:'loc3', name:'Franklin Elementary',   abbr:'FES', ticket_count:9  },
        { id:'loc4', name:'District Office',       abbr:'DO',  ticket_count:6  },
        { id:'loc5', name:'Transportation Dept',   abbr:'TRANS', ticket_count:2 },
      ]
      const mock_notes: Record<string, any[]> = {
        'iiq-001': [
          { id:'n101', author:'Sarah Johnson', created:new Date(now-3600000).toISOString(), type:'public', body:'Device is in for inspection. Screen cracked at bottom-right corner. Submitting requisition for replacement screen.' },
          { id:'n102', author:'System',        created:new Date(now-7200000).toISOString(), type:'system', body:'Ticket assigned to Sarah Johnson. SLA: 1 business day.' },
        ],
        'iiq-007': [
          { id:'n701', author:'Mike Torres',   created:new Date(now-1800000).toISOString(), type:'public', body:'On site. Switch in Closet B is in a reboot loop every ~90 seconds. Likely power supply failure. Ordered replacement from warehouse.' },
          { id:'n702', author:'Dana Lee',      created:new Date(now-900000).toISOString(),  type:'public', body:'Pulled spare 24-port switch from storage. Network restored. Awaiting replacement unit.' },
        ],
      }
      const tickets = [
        { id:'iiq-001', number:'23-10041', title:'Laptop screen cracked',               description:'Student dropped device during lunch, screen broken',   assignee:'Sarah Johnson', assignee_id:'u001', location_id:'loc1', location_name:'Lincoln High School', status:'Open',        type:'Hardware Repair', priority:'High',   asset_tag:'LHS-001', asset_type:'Chromebook', created:new Date(now-7200000).toISOString(),   updated:new Date(now-3600000).toISOString()   },
        { id:'iiq-002', number:'23-10042', title:'Projector not connecting HDMI',        description:'Room 204 projector issue, no signal',                  assignee:'Mike Torres',   assignee_id:'u002', location_id:'loc1', location_name:'Lincoln High School', status:'In Progress', type:'AV Equipment',    priority:'Medium', asset_tag:'LHS-AV-204', asset_type:'Projector', created:new Date(now-18000000).toISOString(), updated:new Date(now-7200000).toISOString()   },
        { id:'iiq-003', number:'23-10043', title:"iPad won't charge — 4 devices",       description:'3rd period class set in Room 208, 4 iPads not charging', assignee:'Sarah Johnson', assignee_id:'u001', location_id:'loc2', location_name:'Jefferson Middle',   status:'Open',        type:'Hardware Repair', priority:'High',   asset_tag:'',        asset_type:'iPad',       created:new Date(now-3600000).toISOString(),   updated:new Date(now-3600000).toISOString()   },
        { id:'iiq-004', number:'23-10044', title:'Student login not working',            description:'Google account locked, student cannot log into Chromebook', assignee:'Dana Lee',   assignee_id:'u003', location_id:'loc2', location_name:'Jefferson Middle',   status:'Open',        type:'Account Access',  priority:'Medium', asset_tag:'JMS-055', asset_type:'Chromebook', created:new Date(now-86400000).toISOString(), updated:new Date(now-43200000).toISOString()  },
        { id:'iiq-005', number:'23-10045', title:'Chromebook keyboard stuck',            description:'Keys W and S unresponsive on device FES-012',           assignee:'Mike Torres',   assignee_id:'u002', location_id:'loc3', location_name:'Franklin Elementary', status:'Open',        type:'Hardware Repair', priority:'Low',    asset_tag:'FES-012', asset_type:'Chromebook', created:new Date(now-172800000).toISOString(), updated:new Date(now-172800000).toISOString() },
        { id:'iiq-006', number:'23-10046', title:'Printer offline in main office',       description:'HP LaserJet not showing on network',                    assignee:'Dana Lee',       assignee_id:'u003', location_id:'loc3', location_name:'Franklin Elementary', status:'In Progress', type:'Network/Printer', priority:'Medium', asset_tag:'FES-P02', asset_type:'Printer',    created:new Date(now-43200000).toISOString(), updated:new Date(now-21600000).toISOString()  },
        { id:'iiq-007', number:'23-10047', title:'Network switch rebooting loop',        description:'Closet B switch cycling every 2 minutes',               assignee:'Sarah Johnson', assignee_id:'u001', location_id:'loc4', location_name:'District Office',    status:'Open',        type:'Network/Infra',   priority:'Urgent', asset_tag:'DO-SW-B02', asset_type:'Network Switch', created:new Date(now-1800000).toISOString(), updated:new Date(now-1800000).toISOString() },
        { id:'iiq-008', number:'23-10048', title:'VPN access request — new hire',        description:'Maria Gonzalez, starts Monday, needs VPN access',       assignee:'Dana Lee',       assignee_id:'u003', location_id:'loc4', location_name:'District Office',    status:'Closed',      type:'Account Access',  priority:'Low',    asset_tag:'',        asset_type:'',           created:new Date(now-259200000).toISOString(), updated:new Date(now-86400000).toISOString()  },
        { id:'iiq-009', number:'23-10049', title:'Smart board calibration needed',       description:'Room 112 smart board touch is off',                    assignee:'Mike Torres',   assignee_id:'u002', location_id:'loc1', location_name:'Lincoln High School', status:'Closed',      type:'AV Equipment',    priority:'Low',    asset_tag:'LHS-SB-112', asset_type:'Smart Board', created:new Date(now-345600000).toISOString(), updated:new Date(now-259200000).toISOString() },
        { id:'iiq-010', number:'23-10050', title:'Missing device — LHS-042',             description:'Chromebook not seen since field trip last Thursday',    assignee:'Sarah Johnson', assignee_id:'u001', location_id:'loc1', location_name:'Lincoln High School', status:'Open',        type:'Missing/Stolen',  priority:'High',   asset_tag:'LHS-042', asset_type:'Chromebook', created:new Date(now-21600000).toISOString(),  updated:new Date(now-21600000).toISOString()  },
      ]
      const agents = [
        { id:'u001', name:'Sarah Johnson', email:'sjohnson@district.edu', location_id:'loc1', open_tickets:4, role:'Technician' },
        { id:'u002', name:'Mike Torres',   email:'mtorres@district.edu',  location_id:'loc2', open_tickets:3, role:'Technician' },
        { id:'u003', name:'Dana Lee',      email:'dlee@district.edu',     location_id:'loc3', open_tickets:3, role:'Technician' },
      ]
      const workflows = [
        { id:'wf1', name:'Hardware Repair',   sla_hours:24, default_priority:'Medium' },
        { id:'wf2', name:'Account Access',    sla_hours:4,  default_priority:'High'   },
        { id:'wf3', name:'AV Equipment',      sla_hours:48, default_priority:'Low'    },
        { id:'wf4', name:'Network/Infra',     sla_hours:2,  default_priority:'Urgent' },
        { id:'wf5', name:'Missing/Stolen',    sla_hours:24, default_priority:'High'   },
        { id:'wf6', name:'Network/Printer',   sla_hours:24, default_priority:'Medium' },
      ]
      const sync_data = { groups, tickets, agents, workflows, mock_notes, synced_at: new Date().toISOString() }
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'incident-iq', credentials:{ mode:'mock' }, status:'connected', sync_data, last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true, sync_data })
    }

    if (action === 'save') {
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'incident-iq', credentials:payload.credentials, status:'connected', last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true })
    }
    if (action === 'load') {
      const { data, error } = await sb.from('connector_credentials').select('sync_data, last_sync').eq('org_id', org_id).eq('connector_id', 'incident-iq').single()
      if (error) throw error
      return respond({ ok:true, ...data })
    }

    if (action === 'sync') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') throw new Error('Mock mode — use real Incident IQ URL and API key')
      const [tkRes, locRes, agRes] = await Promise.all([
        iiqFetch(creds, '/issues?statusIds=1,2,3&pageSize=500'),
        iiqFetch(creds, '/locations?pageSize=200'),
        iiqFetch(creds, '/users?userTypeId=2&pageSize=200'),
      ])
      const [tkData, locData, agData] = await Promise.all([tkRes.json(), locRes.json(), agRes.json()])
      const groups = (locData.Payload?.Items || []).map((l: any) => ({ id:'loc-'+l.LocationId, name:l.Name, abbr:l.ShortName || '', ticket_count:0 }))
      const tickets = (tkData.Payload?.Items || []).map((t: any) => ({
        id:'iiq-'+t.IssueId, number:String(t.IssueId), title:t.Subject,
        description:t.IssueDescription || '', assignee:t.AssigneeName || 'Unassigned',
        location_id:'loc-'+t.LocationId, location_name:t.LocationName || '',
        status:t.StatusName, type:t.TypeName, priority:t.PriorityName,
        asset_tag:t.AssetTag || '', created:t.CreatedDate, updated:t.UpdatedDate,
      }))
      const agents = (agData.Payload?.Items || []).map((u: any) => ({
        id:'u-'+u.UserId, name:`${u.FirstName} ${u.LastName}`, email:u.Email, open_tickets:0, role:'Technician',
      }))
      const sync_data = { groups, tickets, agents, workflows: [], mock_notes: {}, synced_at: new Date().toISOString() }
      await sb.from('connector_credentials').update({ sync_data, last_sync: new Date().toISOString() }).eq('org_id', org_id).eq('connector_id', 'incident-iq')
      return respond({ ok:true, counts: { tickets: tickets.length } })
    }

    if (action === 'get_ticket') {
      const { credentials: creds, sync_data } = await getCreds()
      if (creds.mode === 'mock') {
        const notes = sync_data?.mock_notes?.[ticket_id] || []
        return respond({ ok:true, notes })
      }
      const res = await iiqFetch(creds, `/issues/${ticket_id.replace('iiq-','')}/comments`)
      const data = await res.json()
      const notes = (data.Payload?.Items || []).map((n: any) => ({
        id:'n-'+n.CommentId, author:n.AuthorName, created:n.CreatedDate, type:n.CommentTypeId===1?'public':'internal', body:n.CommentText,
      }))
      return respond({ ok:true, notes })
    }

    if (action === 'add_note') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') return respond({ ok:true, message:'Mock: note added' })
      const res = await iiqFetch(creds, `/issues/${ticket_id.replace('iiq-','')}/comments`, 'POST', { CommentText:payload.body, CommentTypeId:payload.internal?2:1 })
      if (!res.ok) throw new Error(`Add note error: ${res.status}`)
      return respond({ ok:true })
    }

    throw new Error('Unknown action: ' + action)
  } catch (e: any) {
    return respond({ ok:false, error: e.message }, 400)
  }
})
